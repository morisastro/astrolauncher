import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createHash } from 'node:crypto';

const rl = createInterface({ input: stdin, output: stdout });

async function main() {
  const version = await rl.question('New version (e.g. 1.0.1): ');
  const notes = await rl.question('Release notes: ');

  console.log('\nProvide download URLs for each platform:');
  const winUrl = await rl.question('Windows URL: ');
  const linuxUrl = await rl.question('Linux URL: ');
  const darwinUrl = await rl.question('macOS URL: ');

  const winSha = await rl.question('Windows SHA512 (or leave empty): ');
  const linuxSha = await rl.question('Linux SHA512 (or leave empty): ');
  const darwinSha = await rl.question('macOS SHA512 (or leave empty): ');

  const manifest = {
    version,
    releaseDate: new Date().toISOString(),
    notes,
    platforms: {
      win: { url: winUrl, sha512: winSha || '' },
      linux: { url: linuxUrl, sha512: linuxSha || '' },
      darwin: { url: darwinUrl, sha512: darwinSha || '' },
    },
  };

  const path = resolve(import.meta.dirname, '../../config/update-manifest.json');
  writeFileSync(path, JSON.stringify(manifest, null, 2));
  console.log(`\nUpdate manifest written to ${path}`);
  console.log('Upload your installer files and update the URLs above.\n');

  rl.close();
}

main().catch(console.error);
