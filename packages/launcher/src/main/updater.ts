import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createWriteStream } from 'node:fs';

const API_URL = process.env.API_URL || 'http://57.128.239.39:3001';

export interface UpdateInfo {
  updateAvailable: boolean;
  version?: string;
  releaseDate?: string;
  notes?: string;
  platforms?: {
    win: { url: string; sha512: string };
    linux: { url: string; sha512: string };
    darwin: { url: string; sha512: string };
  };
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    const resp = await fetch(`${API_URL}/api/update/check`);
    return resp.json();
  } catch {
    return { updateAvailable: false };
  }
}

export async function downloadUpdate(url: string, onProgress?: (pct: number) => void): Promise<string> {
  const updateDir = join(app.getPath('temp'), 'astro-launcher-update');
  if (!existsSync(updateDir)) mkdirSync(updateDir, { recursive: true });

  const filename = url.split('/').pop() || 'update.exe';
  const destPath = join(updateDir, filename);

  const resp = await fetch(url);
  if (!resp.ok || !resp.body) throw new Error('Download failed');

  const contentLength = resp.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let downloaded = 0;

  const reader = resp.body.getReader();
  const writer = createWriteStream(destPath);

  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { writer.end(); break; }
      writer.write(Buffer.from(value));
      downloaded += value.length;
      if (total && onProgress) onProgress(Math.round((downloaded / total) * 100));
    }
  };

  await pump();
  await new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return destPath;
}
