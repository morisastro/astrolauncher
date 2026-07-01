import { decryptVault, getDatabaseUrl, vaultExists, type VaultContents } from './lib/vault.js';

let vault: VaultContents | null = null;

export function loadConfig(): { databaseUrl: string; jwtSecret: string; launcherKey: string } {
  const envKey = process.env.ASTRO_VAULT_KEY;

  if (envKey && vaultExists()) {
    vault = decryptVault(envKey);
    return {
      databaseUrl: getDatabaseUrl(vault),
      jwtSecret: vault.jwtSecret,
      launcherKey: vault.launcherKey,
    };
  }

  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;
  const launcherKey = process.env.LAUNCHER_KEY || 'dev-key';

  if (!databaseUrl || !jwtSecret) {
    console.error('No ASTRO_VAULT_KEY or DATABASE_URL/JWT_SECRET found.');
    process.exit(1);
  }

  return { databaseUrl, jwtSecret, launcherKey };
}

export function getVault(): VaultContents | null {
  return vault;
}
