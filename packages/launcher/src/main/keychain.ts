import { createHash } from 'node:crypto';

const MASK_SALT = 'AstroLauncher';

const _k: { v: string; c: string[] } = {
  "v": "1.0.0",
  "c": ["0ATggsoL+kk=", "j2WieLuCjkA=", "Jya4PPy7ePg=", "bzAJwpT+0z0="]
};

function deriveMask(version: string): Buffer {
  return createHash('sha256').update(MASK_SALT).update(version).digest();
}

export function getLauncherKey(): string {
  const mask = deriveMask(_k.v);
  const xored = Buffer.concat(_k.c.map(c => Buffer.from(c, 'base64')));
  const key = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    key[i] = xored[i] ^ mask[i % mask.length];
  }
  return key.toString('hex');
}
