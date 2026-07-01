import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { authMiddleware, type AuthPayload } from '../middleware/auth.js';

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

const loginSchema = z.object({
  login: z.string(),
  password: z.string(),
});

export function createAuthRouter(prisma: PrismaClient, jwtSecret: string) {
  const router = Router();
  const auth = authMiddleware(jwtSecret);

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { username, email, password } = parsed.data;
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      res.status(409).json({ error: 'Username or email already taken' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const userCount = await prisma.user.count();
    const user = await prisma.user.create({
      data: {
        username, email, password: hash,
        role: userCount === 0 ? 'OWNER' : 'USER',
      },
      select: { id: true, username: true, email: true, role: true, rankId: true, createdAt: true },
    });

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role } satisfies AuthPayload,
      jwtSecret,
      { expiresIn: '7d' },
    );

    res.status(201).json({ user, token });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { login, password } = parsed.data;
    const user = await prisma.user.findFirst({
      where: { OR: [{ username: login }, { email: login }] },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role } satisfies AuthPayload,
      jwtSecret,
      { expiresIn: '7d' },
    );

    res.json({
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      token,
    });
  });

  router.get('/me', auth, async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, username: true, email: true, role: true, avatar: true,
        rank: { select: { name: true, displayName: true, color: true, icon: true } },
        createdAt: true,
      },
    });
    if (!user) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(user);
  });

  return router;
}
