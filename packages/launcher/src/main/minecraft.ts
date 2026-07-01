import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';

interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; type: string; url: string; time: string; releaseTime: string }[];
}

interface VersionJson {
  id: string;
  type: string;
  mainClass: string;
  inheritsFrom?: string;
  arguments?: { game: (string | { rules: any[]; value: string | string[] })[]; jvm: (string | { rules: any[]; value: string | string[] })[] };
  minecraftArguments?: string;
  assetIndex: { id: string; url: string; totalSize: number };
  downloads: { client: { url: string; size: number; sha1: string }; server?: { url: string; size: number; sha1: string } };
  libraries: {
    name: string;
    downloads?: {
      artifact?: { path: string; url: string; size: number; sha1: string };
      classifiers?: Record<string, { path: string; url: string; size: number; sha1: string }>;
    };
    rules?: { action: string; os?: { name?: string; arch?: string; version?: string } }[];
  }[];
  logging?: Record<string, any>;
  releaseTime: string;
}

const MC_DIR = process.env.MC_DIR || join(process.env.APPDATA || '.', '.astro-launcher', 'minecraft');
const MOJANG_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const ASSETS_BASE = 'https://resources.download.minecraft.net';

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  ensureDir(dest.substring(0, dest.lastIndexOf('\\') === -1 ? dest.lastIndexOf('/') : dest.lastIndexOf('\\')));
  const resp = await fetch(url);
  if (!resp.ok || !resp.body) throw new Error(`Download failed: ${url} (${resp.status})`);
  const reader = resp.body.getReader();
  const writer = createWriteStream(dest);
  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { writer.end(); break; }
      writer.write(Buffer.from(value));
    }
  };
  await pump();
  await new Promise<void>((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
}

export async function fetchVersionManifest(): Promise<VersionManifest> {
  const resp = await fetch(MOJANG_MANIFEST);
  return resp.json();
}

export async function getVersionJson(versionName: string): Promise<VersionJson> {
  const manifest = await fetchVersionManifest();
  const entry = manifest.versions.find(v => v.id === versionName);
  if (!entry) throw new Error(`Version ${versionName} not found`);
  const resp = await fetch(entry.url);
  return resp.json();
}

export class MinecraftProcess {
  private process: ChildProcess | null = null;
  onOutput: ((line: string) => void) | null = null;
  onError: ((line: string) => void) | null = null;
  onExit: ((code: number | null) => void) | null = null;
  onProgress: ((msg: string, pct: number) => void) | null = null;

  async downloadVersion(versionName: string, onProgress?: (msg: string, pct: number) => void) {
    const versionDir = join(MC_DIR, 'versions', versionName);
    const jarPath = join(versionDir, `${versionName}.jar`);
    ensureDir(versionDir);

    if (onProgress) onProgress(`Fetching version info for ${versionName}...`, 0);
    const vJson = await getVersionJson(versionName);
    writeFileSync(join(versionDir, `${versionName}.json`), JSON.stringify(vJson, null, 2));

    if (!existsSync(jarPath)) {
      if (onProgress) onProgress(`Downloading ${versionName} client...`, 10);
      await downloadFile(vJson.downloads.client.url, jarPath);
    }

    if (onProgress) onProgress(`Processing libraries...`, 30);
    const libsDir = join(MC_DIR, 'libraries');
    const nativesDir = join(versionDir, 'natives');
    ensureDir(nativesDir);

    let totalLibs = vJson.libraries.length;
    let doneLibs = 0;

    for (const lib of vJson.libraries) {
      const artifact = lib.downloads?.artifact;
      if (artifact && !existsSync(join(libsDir, artifact.path))) {
        await downloadFile(artifact.url, join(libsDir, artifact.path));
      }

      if (lib.downloads?.classifiers) {
        const osName = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
        const classifier = lib.downloads.classifiers[`natives-${osName}`];
        if (classifier) {
          const nativePath = join(libsDir, classifier.path);
          if (!existsSync(nativePath)) {
            await downloadFile(classifier.url, nativePath);
          }
        }
      }

      doneLibs++;
      if (onProgress) onProgress(`Downloading libraries... (${doneLibs}/${totalLibs})`, 30 + (doneLibs / totalLibs) * 30);
    }

    if (onProgress) onProgress(`Downloading assets...`, 70);
    const assetsDir = join(MC_DIR, 'assets');
    const objectsDir = join(assetsDir, 'objects');
    const indexesDir = join(assetsDir, 'indexes');
    ensureDir(objectsDir);
    ensureDir(indexesDir);

    const assetIndexPath = join(indexesDir, `${vJson.assetIndex.id}.json`);
    if (!existsSync(assetIndexPath)) {
      await downloadFile(vJson.assetIndex.url, assetIndexPath);
    }
    const assetIndex = JSON.parse(readFileSync(assetIndexPath, 'utf-8'));
    const objects = Object.entries(assetIndex.objects || {}) as [string, { hash: string; size: number }][];
    let doneAssets = 0;

    for (const [key, obj] of objects) {
      const hash = obj.hash;
      const subDir = hash.substring(0, 2);
      const objPath = join(objectsDir, subDir, hash);
      if (!existsSync(objPath)) {
        ensureDir(join(objectsDir, subDir));
        try {
          await downloadFile(`${ASSETS_BASE}/${subDir}/${hash}`, objPath);
        } catch { }
      }
      doneAssets++;
      if (doneAssets % 50 === 0 && onProgress) {
        onProgress(`Downloading assets... (${doneAssets}/${objects.length})`, 70 + (doneAssets / objects.length) * 20);
      }
    }

    if (onProgress) onProgress(`Ready to launch!`, 100);
  }

  async launch(versionName: string, javaPath?: string, username?: string, jvmArgs?: string[]) {
    const versionDir = join(MC_DIR, 'versions', versionName);
    const vJsonPath = join(versionDir, `${versionName}.json`);
    if (!existsSync(vJsonPath)) throw new Error(`Version ${versionName} not downloaded`);

    const vJson: VersionJson = JSON.parse(readFileSync(vJsonPath, 'utf-8'));
    const java = javaPath || 'java';

    const libsDir = join(MC_DIR, 'libraries');
    const nativesDir = join(versionDir, 'natives');
    const assetsDir = join(MC_DIR, 'assets');

    const classpath: string[] = [];
    const osName = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
    const arch = process.arch === 'x64' ? '64' : '32';

    for (const lib of vJson.libraries) {
      if (lib.rules) {
        let allowed = false;
        for (const rule of lib.rules) {
          const os = rule.os || {};
          const matchesOs = !os.name || os.name === osName;
          const matchesArch = !os.arch || os.arch === arch;
          if (matchesOs && matchesArch) {
            allowed = rule.action === 'allow';
          }
        }
        if (!allowed) continue;
      }

      const artifact = lib.downloads?.artifact;
      if (artifact && existsSync(join(libsDir, artifact.path))) {
        classpath.push(join(libsDir, artifact.path));
      }

      if (lib.downloads?.classifiers) {
        const nativeKey = `natives-${osName}`;
        const classifier = lib.downloads.classifiers[nativeKey];
        if (classifier) {
          const nativePath = join(libsDir, classifier.path);
          if (existsSync(nativePath)) classpath.push(nativePath);
        }
      }
    }

    classpath.push(join(versionDir, `${versionName}.jar`));
    const cp = classpath.join(process.platform === 'win32' ? ';' : ':');

    const gameArgs: string[] = [];
    const rawArgs = vJson.arguments?.game || [];
    for (const arg of rawArgs) {
      if (typeof arg === 'string') {
        gameArgs.push(arg.replace('${auth_player_name}', username || 'Player')
          .replace('${version_name}', versionName)
          .replace('${game_directory}', MC_DIR)
          .replace('${assets_root}', assetsDir)
          .replace('${assets_index_name}', vJson.assetIndex.id)
          .replace('${auth_uuid}', '00000000-0000-0000-0000-000000000000')
          .replace('${auth_access_token}', '0')
          .replace('${user_type}', 'mojang')
          .replace('${version_type}', vJson.type)
          .replace('${user_properties}', '{}'));
      }
    }

    const jvmBaseArgs: string[] = [
      `-Djava.library.path=${nativesDir}`,
      '-Dminecraft.launcher.brand=astro-launcher',
      '-Dminecraft.launcher.version=1.0.0',
      `-cp=${cp}`,
      '-Xmx2G',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+UseG1GC',
      '-XX:G1NewSizePercent=20',
      '-XX:G1ReservePercent=20',
      '-XX:MaxGCPauseMillis=50',
      '-XX:G1HeapRegionSize=32M',
    ];

    if (jvmArgs) jvmBaseArgs.push(...jvmArgs);

    const commandArgs = [...jvmBaseArgs, vJson.mainClass, ...gameArgs];
    this.process = spawn(java, commandArgs, { cwd: MC_DIR, stdio: ['pipe', 'pipe', 'pipe'] });

    this.process.stdout?.on('data', (d) => {
      const lines = d.toString().split('\n').filter(Boolean);
      lines.forEach((l: string) => this.onOutput?.(l));
    });

    this.process.stderr?.on('data', (d) => {
      const lines = d.toString().split('\n').filter(Boolean);
      lines.forEach((l: string) => this.onError?.(l));
    });

    this.process.on('exit', (code) => {
      this.onExit?.(code);
      this.process = null;
    });

    return this.process;
  }

  kill() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  isRunning() {
    return this.process !== null;
  }
}
