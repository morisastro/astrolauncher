const THREE = require('three');

// === CONFIG ===
const API_URL = 'http://localhost:3093';
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
const meshes = { trees: new Map(), rocks: new Map(), structures: new Map(), monsters: new Map(), players: new Map(), npcs: new Map() };

let hp = 100, hunger = 100, stamina = 100, temperature = 37;
let day = 1, isNight = false;
let equippedSlot = 0;
let inventory = {};
let pointerLocked = false;
let chatOpen = false;
let equippedItem = null;

// Textures
let textures = {};

// === PROCEDURAL TEXTURES ===
function makeTexture(size, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createTextures() {
  // Grass texture
  textures.grass = makeTexture(64, (ctx, s) => {
    ctx.fillStyle = '#2d5a1f';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const shade = Math.random() > 0.5 ? '#3a7a2a' : '#1a3a10';
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = '#4a8a3a';
      ctx.fillRect(Math.random() * s, Math.random() * s, 1, 3);
    }
  });
  textures.grass.repeat.set(32, 32);

  // Dirt texture
  textures.dirt = makeTexture(64, (ctx, s) => {
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 150; i++) {
      const shades = ['#6a4a2a', '#4a2a10', '#7a5a3a'];
      ctx.fillStyle = shades[Math.floor(Math.random() * 3)];
      ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    }
  });
  textures.dirt.repeat.set(32, 32);

  // Stone texture
  textures.stone = makeTexture(64, (ctx, s) => {
    ctx.fillStyle = '#6a6a6a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 100; i++) {
      const shade = Math.random() > 0.5 ? '#7a7a7a' : '#5a5a5a';
      ctx.fillStyle = shade;
      ctx.fillRect(Math.random() * s, Math.random() * s, 4, 4);
    }
    for (let i = 0; i < 20; i++) {
      ctx.strokeStyle = '#4a4a4a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, Math.random() * s);
      ctx.lineTo(Math.random() * s, Math.random() * s);
      ctx.stroke();
    }
  });
  textures.stone.repeat.set(8, 8);

  // Bark texture
  textures.bark = makeTexture(32, (ctx, s) => {
    ctx.fillStyle = '#3a2510';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = '#2a1500';
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, 0);
      ctx.lineTo(Math.random() * s, s);
      ctx.stroke();
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 1);
    }
  });

  // Leaves texture
  textures.leaves = makeTexture(32, (ctx, s) => {
    ctx.fillStyle = '#1a3a10';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) {
      const shade = Math.random() > 0.5 ? '#2a5a1a' : '#0a2a00';
      ctx.fillStyle = shade;
      ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    }
  });

  // Planks texture (for building)
  textures.planks = makeTexture(32, (ctx, s) => {
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#4a2a10';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 8);
      ctx.lineTo(s, i * 8);
      ctx.stroke();
    }
  });

  // Snow texture
  textures.snow = makeTexture(64, (ctx, s) => {
    ctx.fillStyle = '#d0d0e0';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#e0e0f0' : '#c0c0d0';
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
  textures.snow.repeat.set(32, 32);
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
    if (data.error?.fieldErrors) {
      const errs = Object.values(data.error.fieldErrors).flat();
      throw new Error(errs[0] || 'Validation error');
    }
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
      list.innerHTML = '<p style="color:#8b949e;text-align:center">Brak serwerów.</p>';
    } else {
      list.innerHTML = servers.map(s => `
        <div class="server-card" data-host="${s.host}" data-port="${s.port}">
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

// === CONNECT ===
function connectToServer(host, port) {
  document.getElementById('server-screen').style.display = 'none';
  document.getElementById('game-canvas').style.display = 'block';
  initGame();
  
  const wsUrl = `ws://${host}:${port}`;
  console.log('Connecting to', wsUrl);
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WS connected');
    ws.send(JSON.stringify({ type: 'join', username: user.username }));
  };
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch (e) {
      console.error('Msg parse error:', e);
    }
  };
  
  ws.onerror = (e) => {
    console.error('WS error:', e);
    alert('Błąd połączenia z serwerem gry. Upewnij się że game server działa na porcie ' + port);
  };
  
  ws.onclose = () => {
    console.log('WS closed');
    document.getElementById('hud').style.display = 'none';
    if (!document.getElementById('intro-overlay').style.display.includes('flex')) {
      alert('Rozłączono z serwerem gry');
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
  camera.position.set(0, 12, 5);
  
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  clock = new THREE.Clock();
  
  // Create procedural textures
  createTextures();
  
  // Lights
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
  
  // Generate terrain
  generateTerrain();
  
  // Water
  const waterGeom = new THREE.PlaneGeometry(512, 512);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1a4a6a, transparent: true, opacity: 0.7, metalness: 0.3, roughness: 0.2 });
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
  const size = 128;
  const segments = 64;
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  geom.rotateX(-Math.PI / 2);
  
  const positions = geom.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(i, getTerrainHeight(x, z));
  }
  geom.computeVertexNormals();
  
  // Vertex colors based on height
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    if (y < 0) { colors[i*3] = 0.3; colors[i*3+1] = 0.25; colors[i*3+2] = 0.15; }
    else if (y < 5) { colors[i*3] = 0.18; colors[i*3+1] = 0.36; colors[i*3+2] = 0.12; }
    else if (y < 10) { colors[i*3] = 0.25; colors[i*3+1] = 0.3; colors[i*3+2] = 0.2; }
    else { colors[i*3] = 0.8; colors[i*3+1] = 0.82; colors[i*3+2] = 0.85; }
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const mat = new THREE.MeshStandardMaterial({ 
    vertexColors: true,
    flatShading: true,
    map: textures.grass,
  });
  
  terrainMesh = new THREE.Mesh(geom, mat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
}

function getTerrainHeight(x, z) {
  // Match server's simplex noise approximation
  const s1 = 0.015;
  const s2 = 0.04;
  // Use sin/cos approximation of simplex
  const h1 = Math.sin(x * s1 * 10 + 1.2) * Math.cos(z * s1 * 10 + 3.4) * 12;
  const h2 = Math.sin(x * s2 * 10 + 5.1) * Math.cos(z * s2 * 10 + 2.7) * 4;
  return h1 + h2;
}

// === WORLD OBJECTS ===
function spawnTree(data) {
  const group = new THREE.Group();
  const height = data.y !== undefined ? data.y : getTerrainHeight(data.x, data.z);
  
  // Trunk with bark texture
  const trunkGeom = new THREE.CylinderGeometry(0.3 * data.scale, 0.4 * data.scale, 4 * data.scale, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ map: textures.bark, flatShading: true });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 2 * data.scale;
  trunk.castShadow = true;
  group.add(trunk);
  
  // Leaves
  if (data.type !== 'dead') {
    const leafMat = new THREE.MeshStandardMaterial({ map: textures.leaves, flatShading: true });
    for (let i = 0; i < 3; i++) {
      const coneGeom = new THREE.ConeGeometry((3 - i * 0.6) * data.scale, 2 * data.scale, 7);
      const cone = new THREE.Mesh(coneGeom, leafMat);
      cone.position.y = (4 + i * 1.2) * data.scale;
      cone.castShadow = true;
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
  const geom = new THREE.DodecahedronGeometry(data.scale, 0);
  const mat = new THREE.MeshStandardMaterial({ map: textures.stone, flatShading: true });
  const rock = new THREE.Mesh(geom, mat);
  rock.position.set(data.x, height + data.scale * 0.3, data.z);
  rock.castShadow = true;
  rock.receiveShadow = true;
  rock.userData = { id: data.id, type: 'rock' };
  scene.add(rock);
  meshes.rocks.set(data.id, rock);
}

function spawnStructure(data) {
  const height = getTerrainHeight(data.x, data.z);
  let mesh;
  
  if (data.type === 'wall') {
    const geom = new THREE.BoxGeometry(3, 3, 0.3);
    const mat = new THREE.MeshStandardMaterial({ map: textures.planks, flatShading: true });
    mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(data.x, height + 1.5, data.z);
    mesh.rotation.y = data.rotation;
  } else if (data.type === 'campfire') {
    const geom = new THREE.CylinderGeometry(0.5, 0.7, 0.3, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, emissive: 0xff4400, emissiveIntensity: 0.8 });
    mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(data.x, height + 0.15, data.z);
    const light = new THREE.PointLight(0xff6600, 3, 20);
    light.position.set(data.x, height + 1.5, data.z);
    light.castShadow = true;
    scene.add(light);
    // Fire particles
    const fireGeom = new THREE.ConeGeometry(0.4, 1, 6);
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 });
    const fire = new THREE.Mesh(fireGeom, fireMat);
    fire.position.set(data.x, height + 0.8, data.z);
    fire.userData.isFire = true;
    scene.add(fire);
  } else {
    const geom = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ map: textures.planks, flatShading: true });
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
  const height = data.y !== undefined ? data.y : getTerrainHeight(data.x, data.z);
  const group = new THREE.Group();
  
  const colors = { wolf: 0x4a4a4a, yeti: 0xdddddd, wendigo: 0x8a2a2a, shade: 0x1a1a3a };
  const sizes = { wolf: 0.8, yeti: 2.5, wendigo: 1.4, shade: 0.6 };
  
  const sz = sizes[data.type] || 1;
  const bodyGeom = new THREE.BoxGeometry(sz, sz, sz * 1.5);
  const mat = new THREE.MeshStandardMaterial({ color: colors[data.type] || 0x666666, flatShading: true });
  const body = new THREE.Mesh(bodyGeom, mat);
  body.position.y = sz * 0.5;
  body.castShadow = true;
  group.add(body);
  
  // Head
  const headGeom = new THREE.BoxGeometry(sz * 0.6, sz * 0.6, sz * 0.6);
  const head = new THREE.Mesh(headGeom, mat);
  head.position.set(0, sz * 0.9, sz * 0.7);
  head.castShadow = true;
  group.add(head);
  
  // Glowing eyes
  const eyeGeom = new THREE.SphereGeometry(0.08, 4, 4);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 });
  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(-0.15, sz * 0.95, sz * 0.95);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.15;
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
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.username, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const tagMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const tag = new THREE.Sprite(tagMat);
  tag.position.y = 2.8;
  tag.scale.set(2.5, 0.6, 1);
  group.add(tag);
  
  group.position.set(data.x, height, data.z);
  group.userData = { id: data.id };
  scene.add(group);
  meshes.players.set(data.id, group);
}

function spawnNPCMesh(data) {
  const height = data.y !== undefined ? data.y : getTerrainHeight(data.x, data.z);
  const group = new THREE.Group();
  
  // Body - different colors for guide1 (green) and guide2 (orange)
  const bodyColor = data.role === 'guide1' ? 0x2ecc71 : 0xe67e22;
  const bodyGeom = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
  const mat = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true });
  const body = new THREE.Mesh(bodyGeom, mat);
  body.position.y = 1;
  body.castShadow = true;
  group.add(body);
  
  // Head
  const headGeom = new THREE.SphereGeometry(0.35, 8, 8);
  const head = new THREE.Mesh(headGeom, new THREE.MeshStandardMaterial({ color: 0xddbb88, flatShading: true }));
  head.position.y = 2;
  head.castShadow = true;
  group.add(head);
  
  // Name tag
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = data.role === 'guide1' ? '#2ecc71' : '#e67e22';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.name, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const tagMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const tag = new THREE.Sprite(tagMat);
  tag.position.y = 3;
  tag.scale.set(2.5, 0.6, 1);
  group.add(tag);
  
  group.position.set(data.x, height, data.z);
  group.userData = { id: data.id, role: data.role };
  scene.add(group);
  meshes.npcs.set(data.id, group);
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
    if (e.code === 'KeyC') toggleCrafting();
    if (e.code === 'Escape') {
      if (chatOpen) { chatOpen = false; document.getElementById('chat-input').style.display = 'none'; }
      document.getElementById('crafting-menu').style.display = 'none';
    }
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
    if (!pointerLocked && !chatOpen) renderer.domElement.requestPointerLock();
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
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
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
        ws.send(JSON.stringify({ type: 'action', action: 'attack' }));
      }
      
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
    if (e.code === 'Escape') {
      chatOpen = false;
      e.target.value = '';
      document.getElementById('chat-input').style.display = 'none';
    }
    e.stopPropagation();
  });
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
      
      console.log(`Init: ${world.trees.length} trees, ${world.rocks.length} rocks`);
      
      // Spawn world objects
      world.trees.forEach(spawnTree);
      world.rocks.forEach(spawnRock);
      (msg.structures || []).forEach(spawnStructure);
      (msg.npcs || []).forEach(spawnNPCMesh);
      
      camera.position.set(world.spawnPoint.x, getTerrainHeight(world.spawnPoint.x, world.spawnPoint.z) + 2, world.spawnPoint.z + 3);
      camera.rotation.y = Math.PI;
      
      if (!msg.introComplete) showIntro();
      break;
    
    case 'state':
      for (const p of msg.players) {
        if (p.id === myPlayerId) {
          hp = p.hp; hunger = p.hunger; stamina = p.stamina || stamina;
          updateHUD();
        } else {
          if (!meshes.players.has(p.id)) spawnPlayerMesh(p);
          const mesh = meshes.players.get(p.id);
          if (mesh) {
            mesh.position.x = p.x;
            mesh.position.z = p.z;
            mesh.position.y = getTerrainHeight(p.x, p.z);
            mesh.rotation.y = p.ry;
          }
        }
      }
      for (const [id, mesh] of meshes.players) {
        if (!msg.players.find(p => p.id === id)) { scene.remove(mesh); meshes.players.delete(id); }
      }
      
      for (const m of msg.monsters) {
        if (!meshes.monsters.has(m.id)) spawnMonsterMesh(m);
        const mesh = meshes.monsters.get(m.id);
        if (mesh) {
          mesh.position.x = m.x;
          mesh.position.z = m.z;
          mesh.position.y = getTerrainHeight(m.x, m.z);
        }
      }
      for (const [id, mesh] of meshes.monsters) {
        if (!msg.monsters.find(m => m.id === id)) { scene.remove(mesh); meshes.monsters.delete(id); }
      }
      
      if (msg.day !== day) { day = msg.day; updateHUD(); }
      if (msg.isNight !== isNight) { isNight = msg.isNight; updateDayNight(); }
      break;
    
    case 'inventory':
      inventory = msg.items;
      updateHotbar();
      break;
    
    case 'object_destroyed':
      const tMesh = meshes.trees.get(msg.id);
      const rMesh = meshes.rocks.get(msg.id);
      if (tMesh) { scene.remove(tMesh); meshes.trees.delete(msg.id); }
      if (rMesh) { scene.remove(rMesh); meshes.rocks.delete(msg.id); }
      break;
    
    case 'structure_built':
      spawnStructure(msg.structure);
      break;
    
    case 'monster_killed':
      const mMesh = meshes.monsters.get(msg.id);
      if (mMesh) { scene.remove(mMesh); meshes.monsters.delete(msg.id); }
      addChat('SYSTEM', `${msg.killer} zabił potwora!`);
      break;
    
    case 'join':
      addChat('SYSTEM', `${msg.username} dołączył`);
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
      addChat('SYSTEM', `Dzień ${day} — przetrwaj!`);
      break;
    
    case 'night':
      isNight = true; updateDayNight();
      addChat('SYSTEM', 'Noc nadchodzi... uważajcie na potwory!');
      break;
    
    case 'day':
      isNight = false; updateDayNight();
      addChat('SYSTEM', 'Świt. Zbierajcie surowce.');
      break;
    
    case 'death':
      addChat('SYSTEM', msg.playerId === myPlayerId ? 'Umarłeś!' : 'Gracz zginął');
      break;
    
    case 'intro_start':
      showIntro();
      break;
    
    case 'npc_kidnapped':
      const npcMesh = meshes.npcs.get(msg.npcId);
      if (npcMesh) {
        // Animate NPC flying away (Yeti takes them)
        const startY = npcMesh.position.y;
        const startTime = Date.now();
        const animateKidnap = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          if (elapsed > 2) {
            scene.remove(npcMesh);
            meshes.npcs.delete(msg.npcId);
            return;
          }
          npcMesh.position.y = startY + elapsed * 5;
          npcMesh.position.x += 0.1;
          npcMesh.rotation.z = elapsed * 2;
          requestAnimationFrame(animateKidnap);
        };
        animateKidnap();
      }
      addChat('YETI', `*AARGH! ${msg.name} został porwany przez Yeti!*`);
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
    if (i >= lines.length) { clearInterval(interval); return; }
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
  if (items[equippedSlot]) equippedItem = items[equippedSlot][0];
}

window.selectSlot = (i) => {
  equippedSlot = i;
  updateHotbar();
  const items = Object.entries(inventory).filter(([k, v]) => v > 0);
  if (items[i]) ws.send(JSON.stringify({ type: 'action', action: 'equip', item: items[i][0] }));
};

function updateDayNight() {
  if (isNight) {
    scene.background = new THREE.Color(0x05050a);
    scene.fog.color.setHex(0x05050a);
    scene.fog.near = 8;
    scene.fog.far = 35;
    window.sunLight.intensity = 0.15;
    window.sunLight.color.setHex(0x3355aa);
  } else {
    scene.background = new THREE.Color(0x4a6a9a);
    scene.fog.color.setHex(0x4a6a9a);
    scene.fog.near = 30;
    scene.fog.far = 120;
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
  
  if (myPlayerId && pointerLocked && ws && ws.readyState === WebSocket.OPEN) {
    const speed = keys['ShiftLeft'] && stamina > 0 ? 8 : 5;
    if (keys['ShiftLeft'] && (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'])) {
      stamina = Math.max(0, stamina - 15 * dt);
    }
    
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
    
    if (keys['Space'] && playerOnGround) {
      playerVelocity.y = 6;
      playerOnGround = false;
    }
    playerVelocity.y -= 15 * dt;
    camera.position.y += playerVelocity.y * dt;
    
    const groundY = getTerrainHeight(camera.position.x, camera.position.z) + 1.7;
    if (camera.position.y <= groundY) {
      camera.position.y = groundY;
      playerVelocity.y = 0;
      playerOnGround = true;
    }
    
    camera.position.x = Math.max(-120, Math.min(120, camera.position.x));
    camera.position.z = Math.max(-120, Math.min(120, camera.position.z));
    
    ws.send(JSON.stringify({
      type: 'move',
      x: camera.position.x, y: camera.position.y, z: camera.position.z,
      rx: camera.rotation.x, ry: camera.rotation.y,
    }));
  }
  
  // Animate fire
  const time = Date.now() * 0.005;
  scene.traverse(obj => {
    if (obj.userData.isFire) {
      obj.scale.y = 0.8 + Math.sin(time) * 0.3;
      obj.rotation.y = time;
    }
  });
  
  renderer.render(scene, camera);
}
