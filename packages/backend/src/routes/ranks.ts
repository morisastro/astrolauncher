import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { z } from 'zod';

const createRankSchema = z.object({
  name: z.string().min(1).max(64),
  displayName: z.string().min(1).max(64),
  color: z.string().default('#ffffff'),
  icon: z.string().nullable().optional(),
  priority: z.number().int().default(0),
});

export function createRankRouter(prisma: PrismaClient, jwtSecret: string) {
  const router = Router();
  const auth = authMiddleware(jwtSecret);

  router.get('/', async (_req, res) => {
    const ranks = await prisma.rank.findMany({
      orderBy: { priority: 'desc' },
    });
    res.json(ranks);
  });

  router.post('/', auth, adminOnly, async (req, res) => {
    const parsed = createRankSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const rank = await prisma.rank.create({ data: parsed.data });
    res.status(201).json(rank);
  });

  router.put('/:id', auth, adminOnly, async (req, res) => {
    const parsed = createRankSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const rank = await prisma.rank.update({
      where: { id: String(req.params.id) },
      data: parsed.data,
    });
    res.json(rank);
  });

  router.delete('/:id', auth, adminOnly, async (req, res) => {
    await prisma.rank.delete({ where: { id: String(req.params.id) } });
    res.status(204).end();
  });

  return router;
}
