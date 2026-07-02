import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { z } from 'zod';

const createServerSchema = z.object({
  name: z.string().min(1).max(64),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  region: z.string().optional().default('eu'),
  maxPlayers: z.number().int().min(1).max(20).optional().default(5),
  password: z.string().nullable().optional(),
});

export function createServerBrowserRouter(prisma: PrismaClient, jwtSecret: string) {
  const router = Router();
  const auth = authMiddleware(jwtSecret);

  router.get('/', async (_req, res) => {
    const servers = await prisma.gameServer.findMany({
      where: { status: 'online' },
      select: {
        id: true, name: true, host: true, port: true, region: true,
        maxPlayers: true, currentPlayers: true, day: true, status: true,
        owner: { select: { username: true } },
      },
      orderBy: { currentPlayers: 'desc' },
    });
    res.json(servers);
  });

  router.get('/:id', async (req, res) => {
    const server = await prisma.gameServer.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true, name: true, host: true, port: true, region: true,
        maxPlayers: true, currentPlayers: true, day: true, status: true,
        password: true,
        owner: { select: { username: true, id: true } },
      },
    });
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    res.json(server);
  });

  router.post('/', auth, async (req, res) => {
    const parsed = createServerSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const server = await prisma.gameServer.create({
      data: { ...parsed.data, ownerId: req.user!.userId },
    });
    res.status(201).json(server);
  });

  router.patch('/:id', auth, async (req, res) => {
    const existing = await prisma.gameServer.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    if (existing.ownerId !== req.user!.userId && req.user!.role !== 'OWNER' && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Not your server' }); return;
    }

    const updateSchema = z.object({
      name: z.string().optional(),
      currentPlayers: z.number().int().optional(),
      day: z.number().int().optional(),
      status: z.string().optional(),
      maxPlayers: z.number().int().optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const server = await prisma.gameServer.update({
      where: { id: String(req.params.id) },
      data: parsed.data,
    });
    res.json(server);
  });

  router.delete('/:id', auth, async (req, res) => {
    const existing = await prisma.gameServer.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    if (existing.ownerId !== req.user!.userId && req.user!.role !== 'OWNER' && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Not your server' }); return;
    }
    await prisma.gameServer.delete({ where: { id: String(req.params.id) } });
    res.status(204).end();
  });

  router.post('/:id/heartbeat', auth, async (req, res) => {
    const existing = await prisma.gameServer.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    if (existing.ownerId !== req.user!.userId && req.user!.role !== 'OWNER') {
      res.status(403).json({ error: 'Not your server' }); return;
    }

    const hbSchema = z.object({
      currentPlayers: z.number().int().optional(),
      day: z.number().int().optional(),
      status: z.string().optional(),
    });
    const parsed = hbSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const server = await prisma.gameServer.update({
      where: { id: String(req.params.id) },
      data: { ...parsed.data, updatedAt: new Date() },
    });
    res.json({ ok: true, server });
  });

  return router;
}
