import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { decryptVault, vaultExists } from '../src/lib/vault.js';

const rl = createInterface({ input: stdin, output: stdout });

async function main() {
  if (!vaultExists()) {
    console.error('No vault found. Create one with: npm run vault:create');
    process.exit(1);
  }

  console.log('Enter master passphrase to decrypt vault:');
  const passphrase = await rl.question('Passphrase: ');

  try {
    const contents = decryptVault(passphrase);
    console.log('\n=== Vault Contents ===');
    console.log(`Host:     ${contents.host}`);
    console.log(`Port:     ${contents.port}`);
    console.log(`User:     ${contents.user}`);
    console.log(`Database: ${contents.database}`);
    console.log(`Password: ${'*'.repeat(contents.password.length)}`);
    console.log(`JWT Secret: ${'*'.repeat(16)}`);
    console.log('\nConnection string:');
    console.log(`postgresql://${contents.user}:****@${contents.host}:${contents.port}/${contents.database}`);
  } catch {
    console.error('Failed to decrypt. Wrong passphrase or corrupted vault.');
    process.exit(1);
  }

  rl.close();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
