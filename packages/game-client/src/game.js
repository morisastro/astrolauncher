const THREE = require('three');
const { ipcRenderer } = require('electron');

// === CONFIG ===
const API_URL = 'http://api.morisastro.pl:3001';
const LAUNCHER_KEY = '583582787f59a73a972be0367615f0fbcd1fc1569b893529bb710ebe25659a7d';

// === STATE ===
let token = localStorage.getItem('mayday_token');
let user = null;
let ws = null;
let myPlayerId = null;
let world = null;
let recipes = [];

// Three.js
let scene, camera, renderer, clock;
let terrainMesh, waterMesh;
let playerVelocity = new THREE.Vector3();
let playerOnGround = false;
const keys = {};
const meshes = { trees: new Map(), rocks: new Map(), structures: new Map(), monsters: new Map(), players: new Map() };

// Player state
let hp = 100, hunger = 100, stamina = 100, temperature = 37;
let day = 1, isNight = false;
let equippedSlot = 0;
let inventory = {};
let pointerLocked = false;
let chatOpen = false;

// === API ===
async function apiPost(path, body) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-astro-key': LAUNCHER_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'API error');
  return data;
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'x-astro-key': LAUNCHER_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error('API error');
  return res.json();
}

// === LOGIN ===
document.getElementById('login-btn').onclick = async () => {
  const u = document.getElementById('login-user').value;
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  try {
    const data = await apiPost('/auth/login', { login: u, password: p });
    token = data.token;
    user = data.user;
    localStorage.setItem('mayday_token', token);
    showServers();
  } catch (e) {
    err.textContent = e.message;
  }
};

document.getElementById('register-btn').onclick = async () => {
  const u = document.getElementById('login-user').value;
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  if (!u || !p || p.length < 6) { err.textContent = 'Min 6 znaków hasła'; return; }
  try {
    const data = await apiPost('/auth/register', { username: u, email: u + '@mayday.local', password: p });
    token = data.token;
    user = data.user;
    localStorage.setItem('mayday_token', token);
    showServers();
  } catch (e) {
    err.textContent = e.message;
  }
};

// Auto-login if token exists
if (token) {
  apiGet('/auth/me').then(u => { user = u; showServers(); }).catch(() => { token = null; localStorage.removeItem('mayday_token'); });
}

// === SERVER BROWSER ===
async function showServers() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('server-screen').style.display = 'flex';
  const list = document.getElementById('server-list');
  list.innerHTML = '<p style="color:#8b949e;text-align:center">Ładowanie...</p>';
  try {
    const servers = await apiGet('/servers');
    if (servers.length === 0) {
      list.innerHTML = '<p style="color:#8b949e;text-align:center">Brak serwerów. Poproś admina o utworzenie serwera.</p>';
    } else {
      list.innerHTML = servers.map(s => `
        <div class="server-card" data-id="${s.id}" data-host="${s.host}" data-port="${s.port}">
          <div class="server-info">
            <div class="server-name">${s.name}</div>
            <div class="server-meta">${s.region.toUpperCase()} • Owner: ${s.owner.username}</div>
          </div>
          <div class="server-players">
            <div>${s.currentPlayers}/${s.maxPlayers}</div>
            <div class="server-day">Dzień ${s.day}</div>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('.server-card').forEach(card => {
        card.onclick = () => connectToServer(card.dataset.host, parseInt(card.dataset.port));
      });
    }
  } catch (e) {
    list.innerHTML = '<p style="color:#f85149">Błąd: ' + e.message + '</p>';
  }
}

document.getElementById('refresh-btn').onclick = showServers;
document.getElementById('logout-btn').onclick = () => {
  localStorage.removeItem('mayday_token');
  token = null;
  location.reload();
};

// === CONNECT TO GAME SERVER ===
function connectToServer(host, port) {
  document.getElementById('server-screen').style.display = 'none';
  document.getElementById('game-canvas').style.display = 'block';
  initGame();
  
  const wsUrl = `ws://${host}:${port}`;
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', username: user.username }));
  };
  
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };
  
  ws.onclose = () => {
    document.getElementById('hud').style.display = 'none';
    alert('Rozłączono z serwerem');
    location.reload();
  };
}

// === GAME INIT ===
function initGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 30, 100);
  
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 10, 0);
  
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  clock = new THREE.Clock();
  
  // Lights
  const ambient = new THREE.AmbientLight(0x404060, 0.6);
  scene.add(ambient);
  
  const sunLight = new THREE.DirectionalLight(0xffeedd, 0.8);
  sunLight.position.set(50, 100, 50);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -100;
  sunLight.shadow.camera.right = 100;
  sunLight.shadow.camera.top = 100;
  sunLight.shadow.camera.bottom = -100;
  scene.add(sunLight);
  window.sunLight = sunLight;
  
  // Generate terrain
  generateTerrain();
  
  // Water plane
  const waterGeom = new THREE.PlaneGeometry(512, 512);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1a4a6a, transparent: true, opacity: 0.6 });
  waterMesh = new THREE.Mesh(waterGeom, waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = -3;
  scene.add(waterMesh);
  
  // Input
  setupInput();
  
  // HUD
  document.getElementById('hud').style.display = 'block';
  
  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  animate();
}

function generateTerrain() {
  const size = 256;
  const segments = 128;
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  geom.rotateX(-Math.PI / 2);
  
  const positions = geom.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const h = getNoiseHeight(x, z);
    positions.setY(i, h);
  }
  geom.computeVertexNormals();
  
  const mat = new THREE.MeshStandardMaterial({ 
    color: 0x2d4a2b, 
    flatShading: true,
  });
  
  terrainMesh = new THREE.Mesh(geom, mat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
  
  window.getTerrainHeight = getNoiseHeight;
}

function getNoiseHeight(x, z) {
  // Simple noise approximation matching server
  const s1 = Math.sin(x * 0.015 + 1.2) * Math.cos(z * 0.015 + 3.4) * 12;
  const s2 = Math.sin(x * 0.04 + 5.1) * Math.cos(z * 0.04 + 2.7) * 4;
  return s1 + s2;
}

// === WORLD OBJECTS ===
function spawnTree(data) {
  const group = new THREE.Group();
  const height = getTerrainHeight(data.x, data.z);
  
  // Trunk
  const trunkGeom = new THREE.CylinderGeometry(0.3 * data.scale, 0.4 * data.scale, 4 * data.scale, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: data.type === 'birch' ? 0xd4c5a0 : 0x4a3520, flatShading: true });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 2 * data.scale;
  trunk.castShadow = true;
  group.add(trunk);
  
  // Leaves
  if (data.type !== 'dead') {
    const leafColor = data.type === 'pine' ? 0x1a4a1a : 0x2d5a2d;
    const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, flatShading: true });
    for (let i = 0; i < 3; i++) {
      const coneGeom = new THREE.ConeGeometry((3 - i * 0.6) * data.scale, 2 * data.scale, 7);
      const cone = new THREE.Mesh(coneGeom, leafMat);
      cone.position.y = (4 + i * 1.2) * data.scale;
      cone.castShadow = true;
      group.add(cone);
    }
  }
  
  group.position.set(data.x, height, data.z);
  group.userData = { id: data.id, type: 'tree', hp: data.hp };
  scene.add(group);
  meshes.trees.set(data.id, group);
}

function spawnRock(data) {
  const height = getTerrainHeight(data.x, data.z);
  const geom = new THREE.DodecahedronGeometry(data.scale, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, flatShading: true });
  const rock = new THREE.Mesh(geom, mat);
  rock.position.set(data.x, height + data.scale * 0.3, data.z);
  rock.castShadow = true;
  rock.receiveShadow = true;
  rock.userData = { id: data.id, type: 'rock', hp: data.hp };
  scene.add(rock);
  meshes.rocks.set(data.id, rock);
}

function spawnStructure(data) {
  const height = getTerrainHeight(data.x, data.z);
  let mesh;
  
  if (data.type === 'wall') {
    const geom = new THREE.BoxGeometry(3, 3, 0.3);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, flatShading: true });
    mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(data.x, height + 1.5, data.z);
    mesh.rotation.y = data.rotation;
  } else if (data.type === 'campfire') {
    const geom = new THREE.CylinderGeometry(0.5, 0.7, 0.3, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, emissive: 0xff4400, emissiveIntensity: 0.5 });
    mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(data.x, height + 0.15, data.z);
    const light = new THREE.PointLight(0xff6600, 2, 15);
    light.position.set(data.x, height + 1, data.z);
    scene.add(light);
  } else {
    const geom = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b6914, flatShading: true });
    mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(data.x, height + 1, data.z);
  }
  
  if (mesh) {
    mesh.castShadow = true;
    mesh.userData = { id: data.id, type: data.type };
    scene.add(mesh);
    meshes.structures.set(data.id, mesh);
  }
}

function spawnMonsterMesh(data) {
  const height = getTerrainHeight(data.x, data.z);
  const group = new THREE.Group();
  
  const colors = { wolf: 0x4a4a4a, yeti: 0xdddddd, wendigo: 0x8a2a2a, shade: 0x1a1a3a };
  const sizes = { wolf: 0.8, yeti: 2, wendigo: 1.2, shade: 0.6 };
  
  const size = sizes[data.type] || 1;
  const bodyGeom = new THREE.BoxGeometry(size, size, size * 1.5);
  const mat = new THREE.MeshStandardMaterial({ color: colors[data.type] || 0x666666, flatShading: true });
  const body = new THREE.Mesh(bodyGeom, mat);
  body.position.y = size * 0.5;
  body.castShadow = true;
  group.add(body);
  
  // Eyes
  const eyeGeom = new THREE.SphereGeometry(0.1, 4, 4);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(-0.2, size * 0.7, size * 0.7);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.2;
  group.add(eyeR);
  
  group.position.set(data.x, height, data.z);
  group.userData = { id: data.id };
  scene.add(group);
  meshes.monsters.set(data.id, group);
}

function spawnPlayerMesh(data) {
  if (data.id === myPlayerId) return;
  const height = getTerrainHeight(data.x, data.z);
  const group = new THREE.Group();
  
  const bodyGeom = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3498db, flatShading: true });
  const body = new THREE.Mesh(bodyGeom, mat);
  body.position.y = 1;
  body.castShadow = true;
  group.add(body);
  
  // Name tag
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.username, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const tagMat = new THREE.SpriteMaterial({ map: texture });
  const tag = new THREE.Sprite(tagMat);
  tag.position.y = 2.5;
  tag.scale.set(2, 0.5, 1);
  group.add(tag);
  
  group.position.set(data.x, height, data.z);
  group.userData = { id: data.id };
  scene.add(group);
  meshes.players.set(data.id, group);
}

// === INPUT ===
function setupInput() {
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyT' && !chatOpen) {
      chatOpen = true;
      document.getElementById('chat-input').style.display = 'block';
      document.getElementById('chat-input').focus();
      document.exitPointerLock();
    }
    if (e.code === 'KeyC') {
      toggleCrafting();
    }
    if (e.code === 'Escape') {
      if (chatOpen) { chatOpen = false; document.getElementById('chat-input').style.display = 'none'; }
      document.getElementById('crafting-menu').style.display = 'none';
    }
    // Hotbar 1-5
    if (e.code.startsWith('Digit')) {
      const slot = parseInt(e.code.slice(5)) - 1;
      if (slot >= 0 && slot < 5) {
        equippedSlot = slot;
        updateHotbar();
        const items = Object.keys(inventory).filter(k => inventory[k] > 0);
        if (items[slot]) {
          ws.send(JSON.stringify({ type: 'action', action: 'equip', item: items[slot] }));
        }
      }
    }
  });
  
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  
  document.getElementById('game-canvas').addEventListener('click', () => {
    if (!pointerLocked && !chatOpen) {
      renderer.domElement.requestPointerLock();
    }
  });
  
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!pointerLocked) return;
    camera.rotation.y -= e.movementX * 0.002;
    camera.rotation.x -= e.movementY * 0.002;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
  });
  
  document.addEventListener('mousedown', (e) => {
    if (!pointerLocked) return;
    if (e.button === 0) {
      // Left click - gather or attack
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      
      // Check trees and rocks
      const objects = [...meshes.trees.values(), ...meshes.rocks.values(), ...meshes.monsters.values()];
      const hits = raycaster.intersectObjects(objects, true);
      
      if (hits.length > 0 && hits[0].distance < 5) {
        let obj = hits[0].object;
        while (obj.parent && !obj.userData.id) obj = obj.parent;
        if (obj.userData.id) {
          if (obj.userData.type === 'tree' || obj.userData.type === 'rock') {
            ws.send(JSON.stringify({ type: 'action', action: 'gather', targetId: obj.userData.id }));
          } else if (meshes.monsters.has(obj.userData.id)) {
            ws.send(JSON.stringify({ type: 'action', action: 'attack', targetId: obj.userData.id }));
          }
        }
      } else {
        // Attack empty (melee swing)
        ws.send(JSON.stringify({ type: 'action', action: 'attack' }));
      }
      
      // Build mode - place structure
      if (equippedItem === 'wall' || equippedItem === 'door' || equippedItem === 'campfire') {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const pos = camera.position.clone().add(dir.multiplyScalar(3));
        ws.send(JSON.stringify({
          type: 'action', action: 'build', recipeId: equippedItem,
          x: pos.x, y: getTerrainHeight(pos.x, pos.z), z: pos.z, rotation: camera.rotation.y,
        }));
      }
    }
    if (e.button === 2) {
      // Right click - shoot arrow
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      ws.send(JSON.stringify({
        type: 'action', action: 'shoot',
        dx: dir.x, dy: dir.y, dz: dir.z,
      }));
    }
  });
  
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Chat
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
      const msg = e.target.value;
      if (msg.trim()) ws.send(JSON.stringify({ type: 'chat', message: msg }));
      e.target.value = '';
      chatOpen = false;
      document.getElementById('chat-input').style.display = 'none';
      renderer.domElement.requestPointerLock();
    }
    if (e.code === 'Escape') {
      chatOpen = false;
      e.target.value = '';
      document.getElementById('chat-input').style.display = 'none';
    }
  });
}

let equippedItem = null;

// === CRAFTING ===
function toggleCrafting() {
  const menu = document.getElementById('crafting-menu');
  if (menu.style.display === 'block') {
    menu.style.display = 'none';
    renderer.domElement.requestPointerLock();
  } else {
    document.exitPointerLock();
    renderCrafting();
    menu.style.display = 'block';
  }
}

function renderCrafting() {
  const list = document.getElementById('craft-list');
  list.innerHTML = recipes.map(r => {
    const canCraft = r.ingredients.every(ing => (inventory[ing.type] || 0) >= ing.quantity);
    return `
      <div class="craft-item" data-id="${r.id}" style="opacity:${canCraft ? 1 : 0.4}">
        <div>
          <div class="craft-name">${r.outputName}</div>
          <div class="craft-cost">${r.ingredients.map(i => `${i.quantity}x ${i.type}`).join(', ')}</div>
        </div>
        <div style="font-size:11px;color:${canCraft ? '#3fb950' : '#f85149'}">${canCraft ? 'CRAFT' : 'BRAK'}</div>
      </div>
    `;
  }).join('');
  
  list.querySelectorAll('.craft-item').forEach(item => {
    item.onclick = () => {
      ws.send(JSON.stringify({ type: 'action', action: 'build', recipeId: item.dataset.id, x: 0, y: 0, z: 0 }));
      renderCrafting();
    };
  });
}

// === MESSAGE HANDLER ===
function handleMessage(msg) {
  switch (msg.type) {
    case 'init':
      myPlayerId = msg.id;
      world = msg.world;
      recipes = msg.recipes || [];
      day = msg.day;
      isNight = msg.isNight;
      
      // Spawn world objects
      world.trees.forEach(spawnTree);
      world.rocks.forEach(spawnRock);
      msg.structures.forEach(spawnStructure);
      
      camera.position.set(world.spawnPoint.x, getTerrainHeight(world.spawnPoint.x, world.spawnPoint.z) + 2, world.spawnPoint.z);
      
      if (!msg.introComplete) {
        showIntro();
      }
      break;
    
    case 'state':
      // Update players
      for (const p of msg.players) {
        if (p.id === myPlayerId) {
          hp = p.hp;
          hunger = p.hunger;
          stamina = p.stamina || stamina;
          updateHUD();
        } else {
          if (!meshes.players.has(p.id)) {
            spawnPlayerMesh(p);
          }
          const mesh = meshes.players.get(p.id);
          if (mesh) {
            mesh.position.x = p.x;
            mesh.position.z = p.z;
            mesh.position.y = getTerrainHeight(p.x, p.z);
            mesh.rotation.y = p.ry;
          }
        }
      }
      
      // Remove disconnected players
      for (const [id, mesh] of meshes.players) {
        if (!msg.players.find(p => p.id === id)) {
          scene.remove(mesh);
          meshes.players.delete(id);
        }
      }
      
      // Update monsters
      for (const m of msg.monsters) {
        if (!meshes.monsters.has(m.id)) {
          spawnMonsterMesh(m);
        }
        const mesh = meshes.monsters.get(m.id);
        if (mesh) {
          mesh.position.x = m.x;
          mesh.position.z = m.z;
          mesh.position.y = getTerrainHeight(m.x, m.z);
        }
      }
      for (const [id, mesh] of meshes.monsters) {
        if (!msg.monsters.find(m => m.id === id)) {
          scene.remove(mesh);
          meshes.monsters.delete(id);
        }
      }
      
      // Day/night
      if (msg.day !== day) { day = msg.day; updateHUD(); }
      if (msg.isNight !== isNight) {
        isNight = msg.isNight;
        updateDayNight();
      }
      break;
    
    case 'inventory':
      inventory = msg.items;
      updateHotbar();
      break;
    
    case 'object_destroyed':
      const treeMesh = meshes.trees.get(msg.id);
      const rockMesh = meshes.rocks.get(msg.id);
      if (treeMesh) { scene.remove(treeMesh); meshes.trees.delete(msg.id); }
      if (rockMesh) { scene.remove(rockMesh); meshes.rocks.delete(msg.id); }
      break;
    
    case 'object_hit':
      // Flash effect
      break;
    
    case 'structure_built':
      spawnStructure(msg.structure);
      break;
    
    case 'monster_killed':
      const mMesh = meshes.monsters.get(msg.id);
      if (mMesh) { scene.remove(mMesh); meshes.monsters.delete(msg.id); }
      addChat('SYSTEM', `${msg.killer} killed a monster!`);
      break;
    
    case 'join':
      addChat('SYSTEM', `${msg.username} joined`);
      break;
    
    case 'leave':
      const pMesh = meshes.players.get(msg.id);
      if (pMesh) { scene.remove(pMesh); meshes.players.delete(msg.id); }
      break;
    
    case 'chat':
      addChat(msg.username, msg.message);
      break;
    
    case 'newday':
      day = msg.day;
      addChat('SYSTEM', `Dzień ${day} - przetrwaj!`);
      break;
    
    case 'night':
      isNight = true;
      updateDayNight();
      addChat('SYSTEM', 'Noc nadchodzi... uważajcie na potwory!');
      break;
    
    case 'day':
      isNight = false;
      updateDayNight();
      addChat('SYSTEM', 'Świt. Zbierajcie surowce.');
      break;
    
    case 'death':
      addChat('SYSTEM', `${msg.playerId === myPlayerId ? 'Umarłeś' : 'Gracz zginął'} (${msg.killer})`);
      break;
    
    case 'damage':
      // Screen flash
      break;
    
    case 'intro_start':
      showIntro();
      break;
    
    case 'victory':
      alert('ZWYCIĘSTWO! Przetrwaliście 50 dni!');
      break;
  }
}

// === INTRO ===
function showIntro() {
  const overlay = document.getElementById('intro-overlay');
  const text = document.getElementById('intro-text');
  overlay.style.display = 'flex';
  
  const lines = [
    'Budzisz się w nieznanym lesie.',
    'Dwóch przewodników prowadzi grupę przez gęsty mrok.',
    '...',
    'Przewodnik: "Trzymajcie się razem. Nie znam tego miejsca."',
    '...',
    '*NAGLE YETI WYSKAKUJE Z ZAROSLI*',
    '*CHWYTA PRZEWODNIKA I ZNIKA W MROKU*',
    '...',
    'Przewodnik #2: "MUSIMY PRZETRWAĆ. 50 DNI."',
    'Zbieraj drewno, kamień. Buduj schron. Walcz z potworami.',
    'Yeti cię obserwuje...'
  ];
  
  let i = 0;
  text.innerHTML = '';
  const interval = setInterval(() => {
    if (i >= lines.length) {
      clearInterval(interval);
      return;
    }
    text.innerHTML += lines[i] + '<br><br>';
    i++;
  }, 1500);
  
  document.getElementById('intro-btn').onclick = () => {
    overlay.style.display = 'none';
    ws.send(JSON.stringify({ type: 'intro_complete' }));
    renderer.domElement.requestPointerLock();
  };
}

// === HUD ===
function updateHUD() {
  document.getElementById('hp-bar').style.width = Math.max(0, hp) + '%';
  document.getElementById('hunger-bar').style.width = Math.max(0, hunger) + '%';
  document.getElementById('stamina-bar').style.width = Math.max(0, stamina) + '%';
  document.getElementById('temp-bar').style.width = Math.max(0, (temperature - 30) / 10 * 100) + '%';
  document.getElementById('day-num').textContent = `Dzień ${day}`;
  document.getElementById('time-label').textContent = isNight ? 'Noc ☾' : 'Dzień ☀';
}

function updateHotbar() {
  const hotbar = document.getElementById('hotbar');
  const items = Object.entries(inventory).filter(([k, v]) => v > 0).slice(0, 5);
  hotbar.innerHTML = items.map(([item, qty], i) => 
    `<div class="slot ${i === equippedSlot ? 'active' : ''}" onclick="selectSlot(${i})">${item.slice(0,4)}<span class="qty">${qty}</span></div>`
  ).join('');
  
  if (items[equippedSlot]) {
    equippedItem = items[equippedSlot][0];
  }
}

window.selectSlot = (i) => {
  equippedSlot = i;
  updateHotbar();
  const items = Object.entries(inventory).filter(([k, v]) => v > 0);
  if (items[i]) {
    ws.send(JSON.stringify({ type: 'action', action: 'equip', item: items[i][0] }));
  }
};

function updateDayNight() {
  if (isNight) {
    scene.background = new THREE.Color(0x05050a);
    scene.fog.color.setHex(0x05050a);
    scene.fog.near = 10;
    scene.fog.far = 40;
    window.sunLight.intensity = 0.1;
    window.sunLight.color.setHex(0x4466aa);
  } else {
    scene.background = new THREE.Color(0x4a6a9a);
    scene.fog.color.setHex(0x4a6a9a);
    scene.fog.near = 30;
    scene.fog.far = 100;
    window.sunLight.intensity = 0.8;
    window.sunLight.color.setHex(0xffeedd);
  }
  updateHUD();
}

function addChat(username, message) {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="username">${username}:</span> ${message}`;
  const messages = document.getElementById('chat-messages');
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  while (messages.children.length > 50) messages.removeChild(messages.firstChild);
}

// === GAME LOOP ===
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  
  if (myPlayerId && pointerLocked) {
    // Movement
    const speed = keys['ShiftLeft'] ? 8 : 5;
    let mx = 0, mz = 0;
    if (keys['KeyW']) mz -= 1;
    if (keys['KeyS']) mz += 1;
    if (keys['KeyA']) mx -= 1;
    if (keys['KeyD']) mx += 1;
    
    if (mx !== 0 || mz !== 0) {
      const len = Math.sqrt(mx * mx + mz * mz);
      mx /= len; mz /= len;
      const angle = camera.rotation.y;
      const dx = mx * Math.cos(angle) - mz * Math.sin(angle);
      const dz = mx * Math.sin(angle) + mz * Math.cos(angle);
      camera.position.x += dx * speed * dt;
      camera.position.z += dz * speed * dt;
    }
    
    // Jump + gravity
    if (keys['Space'] && playerOnGround) {
      playerVelocity.y = 6;
      playerOnGround = false;
    }
    playerVelocity.y -= 15 * dt;
    camera.position.y += playerVelocity.y * dt;
    
    // Terrain collision
    const groundY = getTerrainHeight(camera.position.x, camera.position.z) + 1.7;
    if (camera.position.y <= groundY) {
      camera.position.y = groundY;
      playerVelocity.y = 0;
      playerOnGround = true;
    }
    
    // World bounds
    camera.position.x = Math.max(-120, Math.min(120, camera.position.x));
    camera.position.z = Math.max(-120, Math.min(120, camera.position.z));
    
    // Send position to server
    ws.send(JSON.stringify({
      type: 'move',
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      rx: camera.rotation.x,
      ry: camera.rotation.y,
    }));
  }
  
  // Animate monsters (bobbing)
  for (const mesh of meshes.monsters.values()) {
    mesh.position.y += Math.sin(Date.now() * 0.005) * 0.02;
  }
  
  renderer.render(scene, camera);
}
