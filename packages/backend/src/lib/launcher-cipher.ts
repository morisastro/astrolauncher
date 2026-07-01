import { createHash } from 'node:crypto';
import { randomBytes } from 'node:crypto';

const MASK_SALT = 'AstroLauncher';
const CHUNK_COUNT = 4;

export function generateLauncherKey(): string {
  return randomBytes(32).toString('hex');
}

function deriveMask(version: string): Buffer {
  return createHash('sha256')
    .update(MASK_SALT)
    .update(version)
    .digest();
}

export interface ObfuscatedKey {
  v: string;
  c: string[];
}

export function obfuscateKey(hexKey: string, version: string): ObfuscatedKey {
  const key = Buffer.from(hexKey, 'hex');
  const mask = deriveMask(version);
  const xored = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xored[i] = key[i] ^ mask[i % mask.length];
  }

  const chunkSize = Math.ceil(32 / CHUNK_COUNT);
  const chunks: string[] = [];
  for (let i = 0; i < CHUNK_COUNT; i++) {
    const chunk = xored.subarray(i * chunkSize, (i + 1) * chunkSize);
    chunks.push(chunk.toString('base64'));
  }

  return { v: version, c: chunks };
}

export function deobfuscateKey(obfuscated: ObfuscatedKey): string {
  const mask = deriveMask(obfuscated.v);
  const xored = Buffer.concat(obfuscated.c.map(c => Buffer.from(c, 'base64')));
  const key = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    key[i] = xored[i] ^ mask[i % mask.length];
  }
  return key.toString('hex');
}
