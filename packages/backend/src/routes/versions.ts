import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const MOJANG_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';

interface MojangVersion {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
}

export function createVersionRouter(prisma: PrismaClient, jwtSecret: string) {
  const router = Router();
  const auth = authMiddleware(jwtSecret);

  router.get('/fetch-remote', auth, async (_req, res) => {
    try {
      const resp = await fetch(MOJANG_MANIFEST);
      const data = await resp.json() as { versions: MojangVersion[] };
      res.json(data.versions);
    } catch {
      res.status(502).json({ error: 'Failed to fetch Mojang manifest' });
    }
  });

  router.get('/sync', auth, adminOnly, async (_req, res) => {
    try {
      const resp = await fetch(MOJANG_MANIFEST);
      const data = await resp.json() as { versions: MojangVersion[] };

      for (const v of data.versions) {
        await prisma.minecraftVersion.upsert({
          where: { name: v.id },
          update: { type: v.type, releaseUrl: v.url },
          create: {
            id: v.id,
            name: v.id,
            type: v.type,
            releaseUrl: v.url,
          },
        });
      }

      const count = await prisma.minecraftVersion.count();
      res.json({ synced: true, total: count });
    } catch {
      res.status(502).json({ error: 'Failed to sync versions' });
    }
  });

  router.get('/', async (_req, res) => {
    const versions = await prisma.minecraftVersion.findMany({
      orderBy: [{ type: 'asc' }, { name: 'desc' }],
    });
    res.json(versions);
  });

  router.get('/:name', async (req, res) => {
    const version = await prisma.minecraftVersion.findUnique({
      where: { name: String(req.params.name) },
    });
    if (!version) { res.status(404).json({ error: 'Version not found' }); return; }
    res.json(version);
  });

  router.post('/:name/install', auth, adminOnly, async (req, res) => {
    const version = await prisma.minecraftVersion.findUnique({
      where: { name: String(req.params.name) },
    });
    if (!version) { res.status(404).json({ error: 'Version not found' }); return; }

    const mcDir = process.env.MC_DIR || './minecraft';
    const versionDir = `${mcDir}/versions/${version.name}`;

    await prisma.minecraftVersion.update({
      where: { name: version.name },
      data: { isInstalled: true, installedPath: versionDir },
    });

    res.json({ installed: true, path: versionDir, version: version.name });
  });

  router.delete('/:name', auth, adminOnly, async (req, res) => {
    await prisma.minecraftVersion.delete({ where: { name: String(req.params.name) } });
    res.status(204).end();
  });

  return router;
}
