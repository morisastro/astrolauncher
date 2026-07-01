import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const ITERATIONS = 100_000;
const DIGEST = 'sha512';

const VAULT_PATH = resolve(import.meta.dirname, '../../../../config/vault/credentials.vault');

export interface VaultContents {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  jwtSecret: string;
  launcherKey: string;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return createHash(DIGEST)
    .update(salt)
    .update(passphrase)
    .digest()
    .subarray(0, KEY_LENGTH);
}

export function encryptVault(contents: VaultContents, passphrase: string): void {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = Buffer.from(JSON.stringify(contents), 'utf-8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([salt, iv, tag, encrypted]);
  writeFileSync(VAULT_PATH, payload);
}

export function decryptVault(passphrase: string): VaultContents {
  if (!existsSync(VAULT_PATH)) {
    throw new Error('Vault file not found at ' + VAULT_PATH);
  }

  const payload = readFileSync(VAULT_PATH);
  let offset = 0;

  const salt = payload.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = payload.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const tag = payload.subarray(offset, offset + TAG_LENGTH);
  offset += TAG_LENGTH;

  const encrypted = payload.subarray(offset);

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8'));
}

export function getDatabaseUrl(vault: VaultContents): string {
  return `postgresql://${vault.user}:${vault.password}@${vault.host}:${vault.port}/${vault.database}`;
}

export function vaultExists(): boolean {
  return existsSync(VAULT_PATH);
}
