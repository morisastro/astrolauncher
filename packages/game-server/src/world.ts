import { createNoise2D } from 'simplex-noise';

export const WORLD_SIZE = 128;
export const SEED = 12345;

const noise2D = createNoise2D(() => SEED);
const noise2D2 = createNoise2D(() => SEED + 1);

export interface Tree {
  x: number;
  z: number;
  type: 'pine' | 'dead' | 'birch';
  scale: number;
  hp: number;
  id: string;
}

export interface Rock {
  x: number;
  z: number;
  scale: number;
  hp: number;
  id: string;
}

export interface Bush {
  x: number;
  z: number;
  id: string;
  berries: number;
}

export interface WorldData {
  trees: Tree[];
  rocks: Rock[];
  bushes: Bush[];
  spawnPoint: { x: number; z: number };
}

export function getTerrainHeight(x: number, z: number): number {
  const s1 = 0.015;
  const s2 = 0.04;
  const h1 = noise2D(x * s1, z * s1) * 12;
  const h2 = noise2D2(x * s2, z * s2) * 4;
  return h1 + h2;
}

export function getBiome(x: number, z: number): 'forest' | 'mountain' | 'snow' {
  const dist = Math.sqrt(x * x + z * z);
  if (dist < 50) return 'forest';
  if (dist < 90) return 'mountain';
  return 'snow';
}

let idCounter = 0;
function nextId() { return `obj${idCounter++}`; }

export function generateWorld(): WorldData {
  const trees: Tree[] = [];
  const rocks: Rock[] = [];
  const bushes: Bush[] = [];

  const half = WORLD_SIZE / 2;
  const step = 8;

  for (let x = -half; x < half; x += step) {
    for (let z = -half; z < half; z += step) {
      const height = getTerrainHeight(x, z);
      const biome = getBiome(x, z);
      const r = Math.random();

      if (height > -2 && height < 15) {
        if (r < 0.25) {
          const treeType = biome === 'snow' ? 'dead' : biome === 'mountain' ? 'pine' : r > 0.12 ? 'pine' : 'birch';
          trees.push({
            x: x + (Math.random() - 0.5) * 5,
            z: z + (Math.random() - 0.5) * 5,
            type: treeType,
            scale: 0.8 + Math.random() * 0.6,
            hp: 3,
            id: nextId(),
          });
        }

        if (r > 0.85 && r < 0.92) {
          rocks.push({
            x: x + (Math.random() - 0.5) * 5,
            z: z + (Math.random() - 0.5) * 5,
            scale: 0.5 + Math.random() * 1,
            hp: 5,
            id: nextId(),
          });
        }

        if (biome === 'forest' && r > 0.92) {
          bushes.push({
            x: x + (Math.random() - 0.5) * 5,
            z: z + (Math.random() - 0.5) * 5,
            id: nextId(),
            berries: Math.floor(Math.random() * 3) + 1,
          });
        }
      }
    }
  }

  console.log(`World generated: ${trees.length} trees, ${rocks.length} rocks, ${bushes.length} bushes`);
  return { trees, rocks, bushes, spawnPoint: { x: 0, z: 0 } };
}

export interface BuiltStructure {
  id: string;
  type: 'wall' | 'door' | 'roof' | 'campfire' | 'chest' | 'tower';
  x: number;
  y: number;
  z: number;
  rotation: number;
  ownerId: string;
  hp: number;
}

export interface Monster {
  id: string;
  type: 'wolf' | 'yeti' | 'wendigo' | 'shade';
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  target: string | null;
  state: 'idle' | 'chasing' | 'attacking' | 'fleeing';
  lastAttack: number;
}

export const RECIPES = [
  { id: 'axe', output: 'axe', outputName: 'Stone Axe', ingredients: [{ type: 'wood', quantity: 3 }, { type: 'stone', quantity: 2 }], category: 'tools' },
  { id: 'pickaxe', output: 'pickaxe', outputName: 'Stone Pickaxe', ingredients: [{ type: 'wood', quantity: 3 }, { type: 'stone', quantity: 3 }], category: 'tools' },
  { id: 'sword', output: 'sword', outputName: 'Stone Sword', ingredients: [{ type: 'wood', quantity: 2 }, { type: 'stone', quantity: 4 }], category: 'weapons' },
  { id: 'bow', output: 'bow', outputName: 'Wooden Bow', ingredients: [{ type: 'wood', quantity: 5 }, { type: 'fiber', quantity: 4 }], category: 'weapons' },
  { id: 'arrow', output: 'arrow', outputName: 'Arrow x5', ingredients: [{ type: 'wood', quantity: 1 }, { type: 'stone', quantity: 1 }], category: 'weapons' },
  { id: 'torch', output: 'torch', outputName: 'Torch', ingredients: [{ type: 'wood', quantity: 1 }, { type: 'fiber', quantity: 1 }], category: 'tools' },
  { id: 'wall', output: 'wall', outputName: 'Wooden Wall', ingredients: [{ type: 'wood', quantity: 4 }], category: 'building' },
  { id: 'door', output: 'door', outputName: 'Wooden Door', ingredients: [{ type: 'wood', quantity: 6 }], category: 'building' },
  { id: 'campfire', output: 'campfire', outputName: 'Campfire', ingredients: [{ type: 'wood', quantity: 5 }, { type: 'stone', quantity: 3 }], category: 'building' },
  { id: 'cooked_meat', output: 'cooked_meat', outputName: 'Cooked Meat', ingredients: [{ type: 'raw_meat', quantity: 1 }], category: 'food' },
];
