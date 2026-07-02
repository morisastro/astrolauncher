const THREE = require('three');

// === CONFIG ===
const API_URL = 'http://localhost:3093';
const LAUNCHER_KEY = '583582787f59a73a972be0367615f0fbcd1fc1569b893529bb710ebe25659a7d';
const GAME_HOST = 'localhost';
const GAME_PORT = 3002;

// === STATE ===
let token = localStorage.getItem('mayday_token');
let user = null;
let ws = null;
let myPlayerId = null;
let world = null;
let recipes = [];

let scene, camera, renderer, clock;
let terrainMesh, waterMesh;
let playerVelocity = new THREE.Vector3();
let playerOnGround = false;
const keys = {};
const meshes = { trees: new Map(), rocks: new Map(), structures: new Map(), monsters: new Map(), players: new Map(), npcs: new Map() };

let hp = 100, hunger = 100, stamina = 100, temperature = 37;
let day = 1, isNight = false;
let equippedSlot = 0;
let inventory = {};
let pointerLocked = false;
let chatOpen = false;
let menuOpen = false;
let equippedItem = null;
let textures = {};
let inGame = false;
let isDead = false;
let respawnTimer = 0;

// === PROCEDURAL TEXTURES ===
function makeTexture(size, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createTextures() {
  textures.grass = makeTexture(64, (ctx, s) => {
    ctx.fillStyle = '#2d5a1f'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 200; i++) { ctx.fillStyle = Math.random() > 0.5 ? '#3a7a2a' : '#1a3a10'; ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  }); textures.grass.repeat.set(32, 32);

  textures.bark = makeTexture(32, (ctx, s) => {
    ctx.fillStyle = '#3a2510'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) { ctx.strokeStyle = '#2a1500'; ctx.lineWidth = 1 + Math.random(); ctx.beginPath(); ctx.moveTo(Math.random() * s, 0); ctx.lineTo(Math.random() * s, s); ctx.stroke(); }
  });

  textures.leaves = makeTexture(32, (ctx, s) => {
    ctx.fillStyle = '#1a3a10'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) { ctx.fillStyle = Math.random() > 0.5 ? '#2a5a1a' : '#0a2a00'; ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
  });

  textures.stone = makeTexture(64, (ctx, s) => {
    ctx.fillStyle = '#6a6a6a'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 100; i++) { ctx.fillStyle = Math.random() > 0.5 ? '#7a7a7a' : '#5a5a5a'; ctx.fillRect(Math.random() * s, Math.random() * s, 4, 4); }
  }); textures.stone.repeat.set(8, 8);

  textures.planks = makeTexture(32, (ctx, s) => {
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * 8); ctx.lineTo(s, i * 8); ctx.stroke(); }
  });
}

// === API ===
async function apiPost(path, body) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-astro-key': LAUNCHER_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    if (typeof data.error === 'string') throw new Error(data.error);
    if (data.error?.formErrors?.[0]) throw new Error(data.error.formErrors[0]);
    throw new Error('Błąd API');
  }
  return data;
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'x-astro-key': LAUNCHER_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error('Błąd API');
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
    token = data.token; user = data.user;
    localStorage.setItem('mayday_token', token);
    showMainMenu();
  } catch (e) { err.textContent = e.message; }
};

document.getElementById('register-btn').onclick = async () => {
  const u = document.getElementById('login-user').value;
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  if (!u || !p || p.length < 6) { err.textContent = 'Min 6 znaków'; return; }
  try {
    const data = await apiPost('/auth/register', { username: u, email: u + '@mayday.local', password: p });
    token = data.token; user = data.user;
    localStorage.setItem('mayday_token', token);
    showMainMenu();
  } catch (e) { err.textContent = e.message; }
};

if (token) {
  apiGet('/auth/me').then(u => { user = u; showMainMenu(); }).catch(() => { token = null; localStorage.removeItem('mayday_token'); });
}

// === MAIN MENU ===
function showMainMenu() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('server-screen').style.display = 'flex';
  const list = document.getElementById('server-list');
  list.innerHTML = `
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:18px;color:#e74c3c;font-weight:700">Witaj, ${user.username}!</div>
      <div style="font-size:13px;color:#8b949e;margin-top:4px">Rola: ${user.role}</div>
    </div>
    <button class="btn" id="play-btn" style="font-size:18px;padding:16px;margin-bottom:12px">▶ ZAGRAJ</button>
    <button class="btn btn-secondary" id="invite-btn" style="margin-bottom:12px">📨 Partia — Zaproś znajomych</button>
    <button class="btn btn-secondary" id="logout-btn">Wyloguj</button>
  `;
  document.getElementById('play-btn').onclick = () => connectToServer(GAME_HOST, GAME_PORT);
  document.getElementById('invite-btn').onclick = () => {
    document.getElementById('server-screen').style.display = 'none';
    document.getElementById('party-screen').style.display = 'flex';
  };
  document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('mayday_token');
    token = null; location.reload();
  };
}

// === CONNECT ===
function connectToServer(host, port) {
  document.getElementById('server-screen').style.display = 'none';
  document.getElementById('game-canvas').style.display = 'block';
  initGame();
  inGame = true;
  
  const wsUrl = `ws://${host}:${port}`;
  console.log('Connecting to', wsUrl);
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => { ws.send(JSON.stringify({ type: 'join', username: user.username })); };
  ws.onmessage = (event) => { try { handleMessage(JSON.parse(event.data)); } catch (e) { console.error(e); } };
  ws.onerror = () => { alert('Błąd połączenia z serwerem gry na porcie ' + port); };
  ws.onclose = () => {
    document.getElementById('hud').style.display = 'none';
    if (!document.getElementById('intro-overlay').style.display.includes('flex')) {
      alert('Rozłączono z serwerem');
      location.reload();
    }
  };
}

// === GAME INIT ===
function initGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4a6a9a);
  scene.fog = new THREE.Fog(0x4a6a9a, 30, 120);
  
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.rotation.order = 'YXZ';
  
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  clock = new THREE.Clock();
  createTextures();
  
  const ambient = new THREE.AmbientLight(0x606080, 0.7);
  scene.add(ambient);
  
  const sunLight = new THREE.DirectionalLight(0xffeedd, 0.9);
  sunLight.position.set(50, 100, 50);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -80;
  sunLight.shadow.camera.right = 80;
  sunLight.shadow.camera.top = 80;
  sunLight.shadow.camera.bottom = -80;
  scene.add(sunLight);
  window.sunLight = sunLight;
  
  generateTerrain();
  
  const waterGeom = new THREE.PlaneGeometry(512, 512);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1a4a6a, transparent: true, opacity: 0.7 });
  waterMesh = new THREE.Mesh(waterGeom, waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = -3;
  scene.add(waterMesh);
  
  setupInput();
  document.getElementById('hud').style.display = 'block';
  
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  animate();
}

function generateTerrain() {
  const size = 256;
  const segments = 96;
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  geom.rotateX(-Math.PI / 2);
  
  const positions = geom.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, getTerrainHeight(positions.getX(i), positions.getZ(i)));
  }
  geom.computeVertexNormals();
  
  const mat = new THREE.MeshStandardMaterial({ vertexColors: false, map: textures.grass, flatShading: true });
  terrainMesh = new THREE.Mesh(geom, mat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
}

function getTerrainHeight(x, z) {
  const s1 = 0.015, s2 = 0.04;
  const h1 = Math.sin(x * s1 * 10 + 1.2) * Math.cos(z * s1 * 10 + 3.4) * 12;
  const h2 = Math.sin(x * s2 * 10 + 5.1) * Math.cos(z * s2 * 10 + 2.7) * 4;
  return h1 + h2;
}

// === WORLD OBJECTS ===
function spawnTree(data) {
  const group = new THREE.Group();
  const height = data.y !== undefined ? data.y : getTerrainHeight(data.x, data.z);
  const trunkGeom = new THREE.CylinderGeometry(0.3 * data.scale, 0.4 * data.scale, 4 * data.scale, 6);
  const trunk = new THREE.Mesh(trunkGeom, new THREE.MeshStandardMaterial({ map: textures.bark, flatShading: true }));
  trunk.position.y = 2 * data.scale; trunk.castShadow = true;
  group.add(trunk);
  if (data.type !== 'dead') {
    const leafMat = new THREE.MeshStandardMaterial({ map: textures.leaves, flatShading: true });
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry((3 - i * 0.6) * data.scale, 2 * data.scale, 7), leafMat);
      cone.position.y = (4 + i * 1.2) * data.scale; cone.castShadow = true;
      group.add(cone);
    }
  }
  group.position.set(data.x, height, data.z);
  group.userData = { id: data.id, type: 'tree' };
  scene.add(group);
  meshes.trees.set(data.id, group);
}

function spawnRock(data) {
  const height = data.y !== undefined ? data.y : getTerrainHeight(data.x, data.z);
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(data.scale, 0),
    new THREE.MeshStandardMaterial({ map: textures.stone, flatShading: true })
  );
  rock.position.set(data.x, height + data.scale * 0.3, data.z);
  rock.castShadow = true; rock.receiveShadow = true;
  rock.userData = { id: data.id, type: 'rock' };
  scene.add(rock);
  meshes.rocks.set(data.id, rock);
}

function spawnStructure(data) {
  const height = getTerrainHeight(data.x, data.z);
  let mesh;
  if (data.type === 'campfire') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a1a0a, emissive: 0xff4400, emissiveIntensity: 0.8 }));
    mesh.position.set(data.x, height + 0.15, data.z);
    const light = new THREE.PointLight(0xff6600, 3, 20);
    light.position.set(data.x, height + 1.5, data.z);
    scene.add(light);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 }));
    fire.position.set(data.x, height + 0.8, data.z);
    fire.userData.isFire = true;
    scene.add(fire);
  } else if (data.type === 'wall') {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.3),
      new THREE.MeshStandardMaterial({ map: textures.planks, flatShading: true }));
    mesh.position.set(data.x, height + 1.5, data.z);
    mesh.rotation.y = data.rotation;
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ map: textures.planks, flatShading: true }));
    mesh.position.set(data.x, height + 1, data.z);
  }
  if (mesh) { mesh.castShadow = true; mesh.userData = { id: data.id, type: data.type }; scene.add(mesh); meshes.structures.set(data.id, mesh); }
}

function spawnMonsterMesh(data) {
  const height = data.y !== undefined ? data.y : getTerrainHeight(data.x, data.z);
  const group = new THREE.Group();
  const colors = { wolf: 0x4a4a4a, yeti: 0xdddddd, wendigo: 0x8a2a2a, shade: 0x1a1a3a };
  const sizes = { wolf: 0.8, yeti: 2.5, wendigo: 1.4, shade: 0.6 };
  const sz = sizes[data.type] || 1;
  const mat = new THREE.MeshStandardMaterial({ color: colors[data.type] || 0x666666, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz * 1.5), mat);
  body.position.y = sz * 0.5; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.6, sz * 0.6, sz * 0.6), mat);
  head.position.set(0, sz * 0.9, sz * 0.7); group.add(head);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 });
  [-0.15, 0.15].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), eyeMat);
    eye.position.set(x, sz * 0.95, sz * 0.95);
    group.add(eye);
  });
  group.position.set(data.x, height, data.z);
  group.userData = { id: data.id };
  scene.add(group);
  meshes.monsters.set(data.id, group);
}

function spawnPlayerMesh(data) {
  if (data.id === myPlayerId) return;
  const height = getTerrainHeight(data.x, data.z);
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.2, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x3498db, flatShading: true }));
  body.position.y = 1; body.castShadow = true; group.add(body);
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(data.username, 128, 40);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
  tag.position.y = 2.8; tag.scale.set(2.5, 0.6, 1);
  group.add(tag);
  group.position.set(data.x, height, data.z);
  group.userData = { id: data.id };
  scene.add(group);
  meshes.players.set(data.id, group);
}

function spawnNPCMesh(data) {
  const height = data.y !== undefined ? data.y : getTerrainHeight(data.x, data.z);
  const group = new THREE.Group();
  const bodyColor = data.role === 'guide1' ? 0x2ecc71 : 0xe67e22;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.2, 4, 8),
    new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true }));
  body.position.y = 1; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xddbb88, flatShading: true }));
  head.position.y = 2; group.add(head);
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = data.role === 'guide1' ? '#2ecc71' : '#e67e22';
  ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(data.name, 128, 40);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
  tag.position.y = 3; tag.scale.set(2.5, 0.6, 1);
  group.add(tag);
  group.position.set(data.x, height, data.z);
  group.userData = { id: data.id };
  scene.add(group);
  meshes.npcs.set(data.id, group);
}

// === INPUT ===
function setupInput() {
  document.addEventListener('keydown', (e) => {
    // ESC — natychmiastowe, bez opóźnienia
    if (e.code === 'Escape') {
      e.preventDefault();
      if (chatOpen) {
        chatOpen = false;
        document.getElementById('chat-input').style.display = 'none';
        return;
      }
      if (document.getElementById('crafting-menu').style.display === 'block') {
        document.getElementById('crafting-menu').style.display = 'none';
        if (!menuOpen) renderer.domElement.requestPointerLock();
        return;
      }
      togglePauseMenu();
      return;
    }
    
    if (menuOpen || chatOpen || isDead) return;
    
    keys[e.code] = true;
    if (e.code === 'KeyT') {
      chatOpen = true;
      document.getElementById('chat-input').style.display = 'block';
      document.getElementById('chat-input').focus();
      document.exitPointerLock();
    }
    if (e.code === 'KeyC') toggleCrafting();
    if (e.code.startsWith('Digit')) {
      const slot = parseInt(e.code.slice(5)) - 1;
      if (slot >= 0 && slot < 5) {
        equippedSlot = slot;
        updateHotbar();
        const items = Object.keys(inventory).filter(k => inventory[k] > 0);
        if (items[slot]) ws.send(JSON.stringify({ type: 'action', action: 'equip', item: items[slot] }));
      }
    }
  });
  
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  
  document.getElementById('game-canvas').addEventListener('click', () => {
    if (!pointerLocked && !chatOpen && !menuOpen) renderer.domElement.requestPointerLock();
  });
  
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!pointerLocked) return;
    camera.rotation.y -= e.movementX * 0.002;
    camera.rotation.x -= e.movementY * 0.002;
    camera.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, camera.rotation.x));
  });
  
  document.addEventListener('mousedown', (e) => {
    if (!pointerLocked) return;
    if (e.button === 0) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      const objects = [...meshes.trees.values(), ...meshes.rocks.values(), ...meshes.monsters.values()];
      const hits = raycaster.intersectObjects(objects, true);
      if (hits.length > 0 && hits[0].distance < 5) {
        let obj = hits[0].object;
        while (obj.parent && !obj.userData.id) obj = obj.parent;
        if (obj.userData.id) {
          if (obj.userData.type === 'tree' || obj.userData.type === 'rock')
            ws.send(JSON.stringify({ type: 'action', action: 'gather', targetId: obj.userData.id }));
          else if (meshes.monsters.has(obj.userData.id))
            ws.send(JSON.stringify({ type: 'action', action: 'attack', targetId: obj.userData.id }));
        }
      } else {
        ws.send(JSON.stringify({ type: 'action', action: 'attack' }));
      }
      if (equippedItem === 'wall' || equippedItem === 'door' || equippedItem === 'campfire') {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const pos = camera.position.clone().add(dir.multiplyScalar(3));
        ws.send(JSON.stringify({ type: 'action', action: 'build', recipeId: equippedItem, x: pos.x, y: getTerrainHeight(pos.x, pos.z), z: pos.z, rotation: camera.rotation.y }));
      }
    }
    if (e.button === 2) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      ws.send(JSON.stringify({ type: 'action', action: 'shoot', dx: dir.x, dy: dir.y, dz: dir.z }));
    }
  });
  
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
      const msg = e.target.value;
      if (msg.trim()) ws.send(JSON.stringify({ type: 'chat', message: msg }));
      e.target.value = '';
      chatOpen = false;
      document.getElementById('chat-input').style.display = 'none';
      renderer.domElement.requestPointerLock();
    }
    if (e.code === 'Escape') { chatOpen = false; e.target.value = ''; document.getElementById('chat-input').style.display = 'none'; }
    e.stopPropagation();
  });

  // Pause menu buttons
  document.getElementById('resume-btn').onclick = togglePauseMenu;
  document.getElementById('exit-btn').onclick = () => {
    if (confirm('Czy na pewno chcesz wyjść z gry?')) {
      require('electron').ipcRenderer.send('quit-app');
    }
  };
  
  // Party screen buttons
  document.getElementById('party-close-btn').onclick = () => {
    document.getElementById('party-screen').style.display = 'none';
    document.getElementById('server-screen').style.display = 'flex';
  };
  document.getElementById('party-send-btn').onclick = async () => {
    const input = document.getElementById('party-invite-input');
    const username = input.value.trim();
    if (!username) return;
    
    // Copy server address to clipboard
    const addr = `${GAME_HOST}:${GAME_PORT}`;
    await navigator.clipboard.writeText(`Dołącz do Mayday Survival! Serwer: ${addr}`);
    
    // Add to party members list
    const members = document.getElementById('party-members');
    const div = document.createElement('div');
    div.innerHTML = `👤 <strong>${username}</strong> <span style="color:#8b949e">(zaproszony)</span>`;
    members.appendChild(div);
    
    input.value = '';
    alert(`Zaproszenie wysłane do: ${username}\n\nAdres serwera skopiowany do schowka!\nPodaj znajomemu: ${addr}`);
  };
}

// === PAUSE MENU ===
function togglePauseMenu() {
  const menu = document.getElementById('pause-menu');
  if (menuOpen) {
    menu.style.display = 'none';
    menuOpen = false;
    if (!isDead) renderer.domElement.requestPointerLock();
  } else {
    if (document.pointerLockElement) document.exitPointerLock();
    menu.style.display = 'flex';
    menuOpen = true;
  }
}

// === DEATH SCREEN ===
function showDeathScreen() {
  isDead = true;
  keys['KeyW'] = keys['KeyS'] = keys['KeyA'] = keys['KeyD'] = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const overlay = document.getElementById('death-screen');
  overlay.style.display = 'flex';
  respawnTimer = 5;
  const timerEl = document.getElementById('respawn-timer');
  const interval = setInterval(() => {
    respawnTimer--;
    if (respawnTimer <= 0) {
      timerEl.textContent = 'Odradzanie...';
      clearInterval(interval);
    } else {
      timerEl.textContent = `Odrodzisz się za ${respawnTimer}s`;
    }
  }, 1000);
}

function hideDeathScreen() {
  isDead = false;
  document.getElementById('death-screen').style.display = 'none';
  renderer.domElement.requestPointerLock();
}

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
    return `<div class="craft-item" data-id="${r.id}" style="opacity:${canCraft ? 1 : 0.4}">
      <div><div class="craft-name">${r.outputName}</div><div class="craft-cost">${r.ingredients.map(i => `${i.quantity}x ${i.type}`).join(', ')}</div></div>
      <div style="font-size:11px;color:${canCraft ? '#3fb950' : '#f85149'}">${canCraft ? 'CRAFT' : 'BRAK'}</div>
    </div>`;
  }).join('');
  list.querySelectorAll('.craft-item').forEach(item => {
    item.onclick = () => { ws.send(JSON.stringify({ type: 'action', action: 'build', recipeId: item.dataset.id, x: 0, y: 0, z: 0 })); renderCrafting(); };
  });
}

// === MESSAGE HANDLER ===
function handleMessage(msg) {
  switch (msg.type) {
    case 'init':
      myPlayerId = msg.id;
      world = msg.world;
      recipes = msg.recipes || [];
      day = msg.day; isNight = msg.isNight;
      world.trees.forEach(spawnTree);
      world.rocks.forEach(spawnRock);
      (msg.structures || []).forEach(spawnStructure);
      (msg.npcs || []).forEach(spawnNPCMesh);
      const spawnY = getTerrainHeight(world.spawnPoint.x, world.spawnPoint.z);
      camera.position.set(world.spawnPoint.x, spawnY + 1.7, world.spawnPoint.z);
      camera.rotation.set(0, 0, 0);
      if (!msg.introComplete) showIntro();
      break;
    case 'state':
      for (const p of msg.players) {
        if (p.id === myPlayerId) {
          hp = p.hp; hunger = p.hunger; stamina = p.stamina || stamina;
          updateHUD();
          // Handle death state
          if (!p.alive && !isDead) {
            showDeathScreen();
          } else if (p.alive && isDead) {
            hideDeathScreen();
          }
        } else {
    scene.background = new THREE.Color(0x4a6a9a);
    scene.fog.color.setHex(0x4a6a9a);
    scene.fog.near = 30; scene.fog.far = 120;
    window.sunLight.intensity = 0.9;
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
  const dt = Math.min(clock.getDelta(), 0.1);
  
  if (myPlayerId && pointerLocked && !menuOpen && !isDead && ws && ws.readyState === WebSocket.OPEN) {
    const speed = (keys['ShiftLeft'] && stamina > 0) ? 8 : 5;
    if (keys['ShiftLeft'] && (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'])) stamina = Math.max(0, stamina - 15 * dt);
    
    // Get camera forward and right vectors (flat on XZ plane)
    const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y));
    const right = new THREE.Vector3(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y));
    
    const moveDir = new THREE.Vector3();
    if (keys['KeyW']) moveDir.add(forward);
    if (keys['KeyS']) moveDir.sub(forward);
    if (keys['KeyD']) moveDir.add(right);
    if (keys['KeyA']) moveDir.sub(right);
    
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      camera.position.x += moveDir.x * speed * dt;
      camera.position.z += moveDir.z * speed * dt;
    }
    
    if (keys['Space'] && playerOnGround) { playerVelocity.y = 6; playerOnGround = false; }
    playerVelocity.y -= 15 * dt;
    camera.position.y += playerVelocity.y * dt;
    
    const groundY = getTerrainHeight(camera.position.x, camera.position.z) + 1.7;
    if (camera.position.y <= groundY) { camera.position.y = groundY; playerVelocity.y = 0; playerOnGround = true; }
    
    camera.position.x = Math.max(-120, Math.min(120, camera.position.x));
    camera.position.z = Math.max(-120, Math.min(120, camera.position.z));
    
    ws.send(JSON.stringify({ type: 'move', x: camera.position.x, y: camera.position.y, z: camera.position.z, rx: camera.rotation.x, ry: camera.rotation.y }));
  }
  
  const time = Date.now() * 0.005;
  scene.traverse(obj => { if (obj.userData.isFire) { obj.scale.y = 0.8 + Math.sin(time) * 0.3; obj.rotation.y = time; } });
  
  renderer.render(scene, camera);
}
