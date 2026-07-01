import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { encryptVault, vaultExists, type VaultContents } from '../src/lib/vault.js';
import { randomBytes } from 'node:crypto';

const rl = createInterface({ input: stdin, output: stdout });

function generateJwtSecret(): string {
  return randomBytes(48).toString('hex');
}

async function main() {
  if (vaultExists()) {
    const overwrite = await rl.question('Vault already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log('\n=== Astro Vault Creator ===\n');

  const host = await rl.question('Database host [57.128.239.39]: ') || '57.128.239.39';
  const portStr = await rl.question('Database port [54235]: ') || '54235';
  const port = parseInt(portStr, 10);
  const user = await rl.question('Database user [astrolauncher]: ') || 'astrolauncher';
  const password = await rl.question('Database password: ');
  const database = await rl.question('Database name [astrolauncher]: ') || 'astrolauncher';

  if (!password) {
    console.error('Password is required!');
    process.exit(1);
  }

  console.log('\n--- Master Passphrase ---');
  console.log('This will be used to encrypt the vault.');
  console.log('Remember it! If lost, the vault cannot be recovered.\n');

  const passphrase = await rl.question('Master passphrase: ');
  const confirm = await rl.question('Confirm passphrase: ');

  if (passphrase !== confirm) {
    console.error('Passphrases do not match!');
    process.exit(1);
  }
  if (passphrase.length < 8) {
    console.error('Passphrase must be at least 8 characters!');
    process.exit(1);
  }

  const contents: VaultContents = {
    host,
    port,
    user,
    password,
    database,
    jwtSecret: generateJwtSecret(),
  };

  encryptVault(contents, passphrase);
  console.log('\nVault created successfully at config/vault/credentials.vault');

  console.log('\nSet this environment variable to auto-decrypt on startup:');
  console.log(`  ASTRO_VAULT_KEY="${passphrase}"`);
  console.log('Or set it as a system environment variable for persistence.\n');

  rl.close();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
