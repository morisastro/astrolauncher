import { Router } from 'express';
import bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { z } from 'zod';

export function createUserRouter(prisma: PrismaClient, jwtSecret: string) {
  const router = Router();
  const auth = authMiddleware(jwtSecret);

  router.get('/', auth, adminOnly, async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true, username: true, email: true, role: true, avatar: true,
        rank: { select: { name: true, displayName: true, color: true, icon: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  });

  router.get('/:id', auth, async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true, username: true, email: true, role: true, avatar: true,
        rank: { select: { name: true, displayName: true, color: true, icon: true } },
        createdAt: true,
      },
    });
    if (!user) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(user);
  });

  const assignRankSchema = z.object({ rankId: z.string().nullable() });

  router.patch('/:id/rank', auth, adminOnly, async (req, res) => {
    const parsed = assignRankSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { rankId: parsed.data.rankId },
      select: {
        id: true, username: true, role: true,
        rank: { select: { name: true, displayName: true, color: true, icon: true } },
      },
    });
    res.json(user);
  });

  const updateRoleSchema = z.object({ role: z.enum(['USER', 'MOD', 'ADMIN', 'OWNER']) });

  router.patch('/:id/role', auth, adminOnly, async (req, res) => {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { role: parsed.data.role },
      select: { id: true, username: true, role: true },
    });
    res.json(user);
  });

  router.delete('/:id', auth, adminOnly, async (req, res) => {
    await prisma.user.delete({ where: { id: String(req.params.id) } });
    res.status(204).end();
  });

  return router;
}
