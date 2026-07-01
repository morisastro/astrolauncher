import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { z } from 'zod';

const createNewsSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
  published: z.boolean().optional().default(false),
});

export function createNewsRouter(prisma: PrismaClient, jwtSecret: string) {
  const router = Router();
  const auth = authMiddleware(jwtSecret);

  router.get('/', async (_req, res) => {
    const news = await prisma.news.findMany({
      where: { published: true },
      select: {
        id: true, title: true, content: true, imageUrl: true,
        author: { select: { username: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(news);
  });

  router.get('/all', auth, adminOnly, async (_req, res) => {
    const news = await prisma.news.findMany({
      select: {
        id: true, title: true, content: true, imageUrl: true, published: true,
        author: { select: { username: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(news);
  });

  router.get('/:id', async (req, res) => {
    const item = await prisma.news.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true, title: true, content: true, imageUrl: true, published: true,
        author: { select: { username: true } },
        createdAt: true, updatedAt: true,
      },
    });
    if (!item) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(item);
  });

  router.post('/', auth, adminOnly, async (req, res) => {
    const parsed = createNewsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const item = await prisma.news.create({
      data: { ...parsed.data, authorId: req.user!.userId },
    });
    res.status(201).json(item);
  });

  router.put('/:id', auth, adminOnly, async (req, res) => {
    const parsed = createNewsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const item = await prisma.news.update({
      where: { id: String(req.params.id) },
      data: parsed.data,
    });
    res.json(item);
  });

  router.delete('/:id', auth, adminOnly, async (req, res) => {
    await prisma.news.delete({ where: { id: String(req.params.id) } });
    res.status(204).end();
  });

  return router;
}
