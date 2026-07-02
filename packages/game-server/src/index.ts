import { WebSocketServer, WebSocket } from 'ws';
import {
  generateWorld, getTerrainHeight, getBiome,
  type WorldData, type BuiltStructure, type Monster, type Tree, type Rock,
  RECIPES,
} from './world.js';

interface Player {
  id: string;
  ws: WebSocket;
  username: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  hp: number;
  hunger: number;
  stamina: number;
  temperature: number;
  alive: boolean;
  inventory: Map<string, number>;
  equipped: string | null;
  lastAction: number;
}

interface GameState {
  players: Map<string, Player>;
  world: WorldData;
  structures: Map<string, BuiltStructure>;
  monsters: Map<string, Monster>;
  day: number;
  timeOfDay: number;
  isNight: boolean;
  gameStarted: boolean;
  introComplete: boolean;
}

const state: GameState = {
  players: new Map(),
  world: generateWorld(),
  structures: new Map(),
  monsters: new Map(),
  day: 1,
  timeOfDay: 0.3,
  isNight: false,
  gameStarted: false,
  introComplete: false,
};

let playerCounter = 0;
let monsterCounter = 0;
let structCounter = 0;

const TICK_RATE = 20;
const DAY_LENGTH = 120000;
const NIGHT_LENGTH = 80000;
const MAX_PLAYERS = 5;

function send(ws: WebSocket, data: any) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function broadcast(data: any, exclude?: string) {
  const msg = JSON.stringify(data);
  for (const p of state.players.values()) {
    if (p.id !== exclude && p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
  }
}

function getSnapshot() {
  return {
    type: 'state',
    players: Array.from(state.players.values()).map(p => ({
      id: p.id, username: p.username,
      x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
      rx: +p.rx.toFixed(3), ry: +p.ry.toFixed(3),
      hp: p.hp, hunger: p.hunger, alive: p.alive,
      equipped: p.equipped,
    })),
    monsters: Array.from(state.monsters.values()).map(m => ({
      id: m.id, type: m.type,
      x: +m.x.toFixed(2), y: +m.y.toFixed(2), z: +m.z.toFixed(2),
      hp: m.hp, state: m.state,
    })),
    day: state.day,
    timeOfDay: state.timeOfDay,
    isNight: state.isNight,
  };
}

function spawnPlayer(player: Player) {
  const spawn = state.world.spawnPoint;
  player.x = spawn.x;
  player.z = spawn.z;
  player.y = getTerrainHeight(spawn.x, spawn.z);
  player.hp = 100;
  player.hunger = 100;
  player.stamina = 100;
  player.temperature = 37;
  player.alive = true;
  player.inventory.set('wood', 0);
  player.inventory.set('stone', 0);
  player.inventory.set('fiber', 0);
}

function spawnMonster(type: Monster['type']) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 40 + Math.random() * 30;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  const stats = {
    wolf: { hp: 40, },
    yeti: { hp: 300, },
    wendigo: { hp: 80, },
    shade: { hp: 25, },
  };

  const id = `m${monsterCounter++}`;
  state.monsters.set(id, {
    id, type,
    x, y: getTerrainHeight(x, z), z,
    hp: stats[type].hp,
    maxHp: stats[type].hp,
    target: null,
    state: 'idle',
    lastAttack: 0,
  });
}

function updateMonsters() {
  if (!state.isNight) {
    state.monsters.clear();
    return;
  }

  if (state.monsters.size < 3 + state.day && Math.random() < 0.02) {
    const types: Monster['type'][] = state.day < 15
      ? ['wolf']
      : state.day < 30
        ? ['wolf', 'wendigo']
        : ['wolf', 'wendigo', 'shade'];
    spawnMonster(types[Math.floor(Math.random() * types.length)]);
  }

  if (state.day >= 5 && Math.random() < 0.001 && !Array.from(state.monsters.values()).some(m => m.type === 'yeti')) {
    spawnMonster('yeti');
  }

  for (const [mid, monster] of state.monsters) {
    const players = Array.from(state.players.values()).filter(p => p.alive);
    if (players.length === 0) continue;

    if (!monster.target || !state.players.has(monster.target) || !state.players.get(monster.target)?.alive) {
      let nearest: Player | null = null;
      let nearestDist = Infinity;
      for (const p of players) {
        const dx = p.x - monster.x;
        const dz = p.z - monster.z;
        const d = dx * dx + dz * dz;
        if (d < nearestDist) { nearestDist = d; nearest = p; }
      }
      monster.target = nearest?.id || null;
      monster.state = nearest ? 'chasing' : 'idle';
    }

    if (monster.target) {
      const target = state.players.get(monster.target);
      if (target && target.alive) {
        const dx = target.x - monster.x;
        const dz = target.z - monster.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const speed = monster.type === 'wolf' ? 4 : monster.type === 'shade' ? 5 : monster.type === 'yeti' ? 3 : 2.5;

        if (dist > 2) {
          monster.x += (dx / dist) * speed * 0.05;
          monster.z += (dz / dist) * speed * 0.05;
          monster.y = getTerrainHeight(monster.x, monster.z);
          monster.state = 'chasing';
        } else {
          monster.state = 'attacking';
          if (Date.now() - monster.lastAttack > 1500) {
            monster.lastAttack = Date.now();
            const dmg = monster.type === 'yeti' ? 25 : monster.type === 'wendigo' ? 15 : 10;
            target.hp -= dmg;
            broadcast({ type: 'damage', targetId: target.id, amount: dmg, source: monster.type });
            if (target.hp <= 0) {
              target.alive = false;
              broadcast({ type: 'death', playerId: target.id, killer: monster.type });
              setTimeout(() => { if (state.players.has(target.id)) spawnPlayer(target); }, 5000);
            }
          }
        }
      }
    }
  }
}

function updateDayNight() {
  const cycleLength = state.isNight ? NIGHT_LENGTH : DAY_LENGTH;
  const increment = 1 / (cycleLength / (1000 / TICK_RATE));
  state.timeOfDay += increment;

  if (state.timeOfDay >= 1) {
    state.timeOfDay = 0;
    state.isNight = !state.isNight;
    if (!state.isNight) {
      state.day++;
      broadcast({ type: 'newday', day: state.day });
      if (state.day > 50) {
        broadcast({ type: 'victory' });
      }
    }
    broadcast({ type: state.isNight ? 'night' : 'day', day: state.day });
  }
}

function updateSurvival() {
  for (const player of state.players.values()) {
    if (!player.alive) continue;

    player.hunger -= 0.02;
    if (player.hunger < 0) {
      player.hunger = 0;
      player.hp -= 0.1;
    }

    const biome = getBiome(player.x, player.z);
    if (biome === 'snow' || biome === 'mountain') {
      player.temperature -= 0.01;
      if (player.temperature < 35) player.hp -= 0.05;
    }

    if (player.stamina < 100) player.stamina += 0.1;

    if (player.hp <= 0) {
      player.alive = false;
      broadcast({ type: 'death', playerId: player.id, killer: 'environment' });
      setTimeout(() => { if (state.players.has(player.id)) spawnPlayer(player); }, 5000);
    }
  }
}

function gameLoop() {
  updateDayNight();
  updateMonsters();
  updateSurvival();
  broadcast(getSnapshot());
}

const PORT = parseInt(process.env.GAME_PORT || '3002', 10);
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

wss.on('connection', (ws, req) => {
  const playerId = `p${playerCounter++}`;
  const ip = req.socket.remoteAddress;

  if (state.players.size >= MAX_PLAYERS) {
    send(ws, { type: 'error', message: 'Server full (max 5 players)' });
    ws.close();
    return;
  }

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      const username = String(msg.username || `Player${playerCounter}`).slice(0, 20);

      const player: Player = {
        id: playerId,
        ws,
        username,
        x: 0, y: 0, z: 0,
        rx: 0, ry: 0,
        hp: 100,
        hunger: 100,
        stamina: 100,
        temperature: 37,
        alive: false,
        inventory: new Map(),
        equipped: null,
        lastAction: 0,
      };

      spawnPlayer(player);
      state.players.set(playerId, player);

      // Only send trees/rocks near spawn point (within 60 units)
      const spawnX = player.x;
      const spawnZ = player.z;
      const nearbyTrees = state.world.trees.filter(t => {
        const dx = t.x - spawnX;
        const dz = t.z - spawnZ;
        return dx * dx + dz * dz < 3600;
      }).map(t => ({ ...t, y: getTerrainHeight(t.x, t.z) }));

      const nearbyRocks = state.world.rocks.filter(r => {
        const dx = r.x - spawnX;
        const dz = r.z - spawnZ;
        return dx * dx + dz * dz < 3600;
      }).map(r => ({ ...r, y: getTerrainHeight(r.x, r.z) }));

      const nearbyBushes = state.world.bushes.filter(b => {
        const dx = b.x - spawnX;
        const dz = b.z - spawnZ;
        return dx * dx + dz * dz < 3600;
      });

      send(ws, {
        type: 'init',
        id: playerId,
        username,
        world: {
          trees: nearbyTrees,
          rocks: nearbyRocks,
          bushes: nearbyBushes,
          spawnPoint: state.world.spawnPoint,
        },
        structures: Array.from(state.structures.values()),
        recipes: RECIPES,
        day: state.day,
        isNight: state.isNight,
        introComplete: state.introComplete,
      });

      broadcast({ type: 'join', id: playerId, username }, playerId);
      console.log(`[${username}] joined (${state.players.size}/${MAX_PLAYERS})`);

      if (state.players.size === 1 && !state.gameStarted) {
        state.gameStarted = true;
        broadcast({ type: 'intro_start' });
      }
    }

    if (msg.type === 'move') {
      const p = state.players.get(playerId);
      if (!p || !p.alive) return;
      p.x = msg.x;
      p.y = msg.y;
      p.z = msg.z;
      p.rx = msg.rx || 0;
      p.ry = msg.ry || 0;
    }

    if (msg.type === 'action') {
      const p = state.players.get(playerId);
      if (!p || !p.alive) return;

      if (msg.action === 'gather') {
        const objId = msg.targetId;
        const tree = state.world.trees.find(t => t.id === objId);
        const rock = state.world.rocks.find(r => r.id === objId);
        const bush = state.world.bushes.find(b => b.id === objId);

        if (tree) {
          tree.hp--;
          if (tree.hp <= 0) {
            const amt = 2 + Math.floor(Math.random() * 3);
            p.inventory.set('wood', (p.inventory.get('wood') || 0) + amt);
            const idx = state.world.trees.indexOf(tree);
            state.world.trees.splice(idx, 1);
            broadcast({ type: 'object_destroyed', id: objId, kind: 'tree' });
            send(p.ws, { type: 'inventory', items: Object.fromEntries(p.inventory) });
          } else {
            broadcast({ type: 'object_hit', id: objId, hp: tree.hp });
          }
        }

        if (rock) {
          rock.hp--;
          if (rock.hp <= 0) {
            const amt = 1 + Math.floor(Math.random() * 2);
            p.inventory.set('stone', (p.inventory.get('stone') || 0) + amt);
            const idx = state.world.rocks.indexOf(rock);
            state.world.rocks.splice(idx, 1);
            broadcast({ type: 'object_destroyed', id: objId, kind: 'rock' });
            send(p.ws, { type: 'inventory', items: Object.fromEntries(p.inventory) });
          } else {
            broadcast({ type: 'object_hit', id: objId, hp: rock.hp });
          }
        }

        if (bush && bush.berries > 0) {
          bush.berries--;
          p.inventory.set('berries', (p.inventory.get('berries') || 0) + 1);
          send(p.ws, { type: 'inventory', items: Object.fromEntries(p.inventory) });
          broadcast({ type: 'object_hit', id: objId, hp: bush.berries });
        }
      }

      if (msg.action === 'build') {
        const recipe = RECIPES.find(r => r.id === msg.recipeId);
        if (!recipe) return;

        const canCraft = recipe.ingredients.every(ing => (p.inventory.get(ing.type) || 0) >= ing.quantity);
        if (!canCraft) { send(p.ws, { type: 'error', message: 'Not enough materials' }); return; }

        for (const ing of recipe.ingredients) {
          p.inventory.set(ing.type, (p.inventory.get(ing.type) || 0) - ing.quantity);
        }

        if (recipe.category === 'building') {
          const sid = `s${structCounter++}`;
          const struct: BuiltStructure = {
            id: sid,
            type: recipe.output as any,
            x: msg.x, y: msg.y, z: msg.z,
            rotation: msg.rotation || 0,
            ownerId: playerId,
            hp: 100,
          };
          state.structures.set(sid, struct);
          broadcast({ type: 'structure_built', structure: struct });
        } else {
          p.inventory.set(recipe.output, (p.inventory.get(recipe.output) || 0) + 1);
          send(p.ws, { type: 'inventory', items: Object.fromEntries(p.inventory) });
        }
      }

      if (msg.action === 'equip') {
        p.equipped = msg.item;
        broadcast({ type: 'equip', playerId, item: msg.item });
      }

      if (msg.action === 'eat') {
        const item = msg.item;
        const qty = p.inventory.get(item) || 0;
        if (qty > 0) {
          p.inventory.set(item, qty - 1);
          if (item === 'berries') { p.hunger = Math.min(100, p.hunger + 10); }
          if (item === 'cooked_meat') { p.hunger = Math.min(100, p.hunger + 40); }
          if (item === 'raw_meat') { p.hunger = Math.min(100, p.hunger + 15); p.hp -= 5; }
          send(p.ws, { type: 'inventory', items: Object.fromEntries(p.inventory) });
        }
      }

      if (msg.action === 'attack') {
        const targets = Array.from(state.monsters.values());
        for (const m of targets) {
          const dx = m.x - p.x;
          const dz = m.z - p.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < 3) {
            const dmg = p.equipped === 'sword' ? 25 : p.equipped === 'axe' ? 15 : 5;
            m.hp -= dmg;
            broadcast({ type: 'monster_hit', id: m.id, hp: m.hp, damage: dmg });
            if (m.hp <= 0) {
              state.monsters.delete(m.id);
              broadcast({ type: 'monster_killed', id: m.id, killer: p.username });
              if (m.type === 'wolf') {
                p.inventory.set('raw_meat', (p.inventory.get('raw_meat') || 0) + 1);
                send(p.ws, { type: 'inventory', items: Object.fromEntries(p.inventory) });
              }
            }
            break;
          }
        }
      }

      if (msg.action === 'shoot') {
        const arrowKey = 'arrow';
        if ((p.inventory.get(arrowKey) || 0) > 0) {
          p.inventory.set(arrowKey, (p.inventory.get(arrowKey) || 0) - 1);
          broadcast({ type: 'arrow', x: p.x, y: p.y + 1.5, z: p.z, dx: msg.dx, dy: msg.dy, dz: msg.dz, ownerId: playerId });
          send(p.ws, { type: 'inventory', items: Object.fromEntries(p.inventory) });
        }
      }
    }

    if (msg.type === 'chat') {
      const p = state.players.get(playerId);
      if (!p) return;
      broadcast({ type: 'chat', playerId, username: p.username, message: String(msg.message).slice(0, 200) });
    }

    if (msg.type === 'intro_complete') {
      state.introComplete = true;
      broadcast({ type: 'intro_done' });
    }
  });

  ws.on('close', () => {
    const p = state.players.get(playerId);
    if (p) {
      console.log(`[${p.username}] left (${state.players.size - 1}/${MAX_PLAYERS})`);
      state.players.delete(playerId);
      broadcast({ type: 'leave', id: playerId });
    }
  });
});

setInterval(gameLoop, 1000 / TICK_RATE);
console.log(`Mayday Survival game server running on port ${PORT}`);
