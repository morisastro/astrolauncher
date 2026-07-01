import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { z } from 'zod';

const MODRINTH_API = 'https://api.modrinth.com/v2';
const CURSEFORGE_API = 'https://api.curseforge.com/v1';

function extractMinecraftVersions(project: any): string[] {
  const versions = project.game_versions || project.mc_versions || project.minecraftVersion || [];
  if (typeof versions === 'string') return [versions];
  if (Array.isArray(versions)) return versions;
  return [];
}

export function createModRouter(prisma: PrismaClient, jwtSecret: string) {
  const router = Router();
  const authMiddlewareInstance = authMiddleware(jwtSecret);

  router.get('/search', async (req, res) => {
    const query = String(req.query.q || '');
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const loader = String(req.query.loader || '');
    const mcVersion = String(req.query.mc || '');

    try {
      let params = new URLSearchParams({
        query,
        limit: String(limit),
        facets: JSON.stringify([['project_type:mod']]),
      });
      if (loader) {
        const lf = [loader].flat();
        params.set('facets', JSON.stringify([['project_type:mod'], lf.map((l: string) => `loaders:${l}`)]));
      }

      const resp = await fetch(`${MODRINTH_API}/search?${params}`, {
        headers: { 'User-Agent': 'AstroLauncher/1.0' },
      });
      if (!resp.ok) { res.status(502).json({ error: 'Modrinth API error' }); return; }
      const data = await resp.json();

      const mods = data.hits.map((hit: any) => ({
        id: hit.project_id,
        name: hit.title,
        description: hit.description,
        logoUrl: hit.icon_url,
        source: 'modrinth',
        minecraftVersions: hit.versions || [],
        downloadUrl: null,
        installed: false,
      }));

      res.json(mods);
    } catch {
      res.status(502).json({ error: 'Failed to search mods' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const resp = await fetch(`${MODRINTH_API}/project/${req.params.id}`, {
        headers: { 'User-Agent': 'AstroLauncher/1.0' },
      });
      if (!resp.ok) { res.status(404).json({ error: 'Mod not found' }); return; }
      const p = await resp.json();

      const verResp = await fetch(`${MODRINTH_API}/project/${req.params.id}/version`, {
        headers: { 'User-Agent': 'AstroLauncher/1.0' },
      });
      const versions = verResp.ok ? await verResp.json() : [];

      res.json({
        id: p.id,
        name: p.title,
        description: p.description,
        logoUrl: p.icon_url,
        source: 'modrinth',
        minecraftVersions: extractMinecraftVersions(p),
        versions: versions.map((v: any) => ({
          id: v.id,
          name: v.name,
          versionNumber: v.version_number,
          loaders: v.loaders,
          gameVersions: v.game_versions,
          files: v.files?.map((f: any) => ({
            url: f.url,
            filename: f.filename,
            size: f.size,
          })),
        })),
      });
    } catch {
      res.status(502).json({ error: 'Failed to fetch mod details' });
    }
  });

  router.get('/:id/:versionId/download-url', async (req, res) => {
    try {
      const resp = await fetch(`${MODRINTH_API}/version/${req.params.versionId}`, {
        headers: { 'User-Agent': 'AstroLauncher/1.0' },
      });
      if (!resp.ok) { res.status(404).json({ error: 'Version not found' }); return; }
      const data = await resp.json();
      const file = data.files?.[0];
      if (!file) { res.status(404).json({ error: 'No files found' }); return; }

      res.json({
        url: file.url,
        filename: file.filename,
        size: file.size,
        sha1: file.hashes?.sha1,
      });
    } catch {
      res.status(502).json({ error: 'Failed to get download URL' });
    }
  });

  return router;
}
