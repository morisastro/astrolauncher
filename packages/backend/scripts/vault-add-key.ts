import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { decryptVault, encryptVault, vaultExists } from '../src/lib/vault.js';
import { generateLauncherKey, obfuscateKey } from '../src/lib/launcher-cipher.js';

const rl = createInterface({ input: stdin, output: stdout });

async function main() {
  if (!vaultExists()) {
    console.error('No vault found. Create one first: npm run vault:create');
    process.exit(1);
  }

  const passphrase = await rl.question('Enter master passphrase to decrypt vault: ');
  let vault;
  try {
    vault = decryptVault(passphrase);
  } catch {
    console.error('Wrong passphrase!');
    process.exit(1);
  }

  if (vault.launcherKey) {
    const overwrite = await rl.question('Launcher key already exists. Regenerate? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const launcherKey = generateLauncherKey();
  vault.launcherKey = launcherKey;

  encryptVault(vault, passphrase);

  const obfuscated = obfuscateKey(launcherKey, '1.0.0');

  console.log('\n=== NEW LAUNCHER KEY GENERATED ===');
  console.log('\nAdd this to your launcher source code:');
  console.log(`\nconst _k = ${JSON.stringify(obfuscated)};`);
  console.log('\nThe key has been encrypted into the vault.');
  console.log('Keep your master passphrase safe!');

  rl.close();
}

main().catch(console.error);
