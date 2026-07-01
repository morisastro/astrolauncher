import { Router } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface UpdateManifest {
  version: string;
  releaseDate: string;
  notes: string;
  platforms: {
    win: { url: string; sha512: string };
    linux: { url: string; sha512: string };
    darwin: { url: string; sha512: string };
  };
}

const MANIFEST_PATH = resolve(import.meta.dirname, '../../../../config/update-manifest.json');

export function createUpdateRouter() {
  const router = Router();

  router.get('/check', (_req, res) => {
    if (!existsSync(MANIFEST_PATH)) {
      res.json({ updateAvailable: false, currentVersion: '1.0.0' });
      return;
    }

    try {
      const manifest: UpdateManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
      res.json({
        updateAvailable: true,
        version: manifest.version,
        releaseDate: manifest.releaseDate,
        notes: manifest.notes,
        platforms: manifest.platforms,
      });
    } catch {
      res.json({ updateAvailable: false, error: 'Invalid manifest' });
    }
  });

  return router;
}
