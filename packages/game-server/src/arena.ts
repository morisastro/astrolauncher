export const ARENA_WIDTH = 1600;
export const ARENA_HEIGHT = 900;
export const PLAYER_RADIUS = 18;
export const PLAYER_SPEED = 3.5;
export const PLAYER_MAX_HP = 100;
export const BULLET_RADIUS = 5;
export const BULLET_SPEED = 9;
export const BULLET_DAMAGE = 15;
export const BULLET_LIFETIME = 120;
export const RESPAWN_TIME = 3000;
export const TICK_RATE = 30;

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WALLS: Wall[] = [
  { x: 0, y: 0, w: ARENA_WIDTH, h: 20 },
  { x: 0, y: ARENA_HEIGHT - 20, w: ARENA_WIDTH, h: 20 },
  { x: 0, y: 0, w: 20, h: ARENA_HEIGHT },
  { x: ARENA_WIDTH - 20, y: 0, w: 20, h: ARENA_HEIGHT },

  { x: 300, y: 200, w: 200, h: 20 },
  { x: 1100, y: 200, w: 200, h: 20 },
  { x: 300, y: 680, w: 200, h: 20 },
  { x: 1100, y: 680, w: 200, h: 20 },

  { x: 700, y: 350, w: 200, h: 20 },
  { x: 700, y: 530, w: 200, h: 20 },

  { x: 250, y: 400, w: 20, h: 100 },
  { x: 1330, y: 400, w: 20, h: 100 },

  { x: 500, y: 100, w: 20, h: 150 },
  { x: 1080, y: 100, w: 20, h: 150 },
  { x: 500, y: 650, w: 20, h: 150 },
  { x: 1080, y: 650, w: 20, h: 150 },

  { x: 750, y: 150, w: 100, h: 20 },
  { x: 750, y: 730, w: 100, h: 20 },
];

export const SPAWN_POINTS = [
  { x: 100, y: 100 },
  { x: ARENA_WIDTH - 100, y: 100 },
  { x: 100, y: ARENA_HEIGHT - 100 },
  { x: ARENA_WIDTH - 100, y: ARENA_HEIGHT - 100 },
  { x: ARENA_WIDTH / 2, y: 100 },
  { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - 100 },
  { x: 100, y: ARENA_HEIGHT / 2 },
  { x: ARENA_WIDTH - 100, y: ARENA_HEIGHT / 2 },
];

export const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
];

export function checkWallCollision(x: number, y: number, radius: number): boolean {
  for (const wall of WALLS) {
    const closestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
    const closestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
    const dx = x - closestX;
    const dy = y - closestY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}
