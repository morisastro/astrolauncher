import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { loadConfig } from './config.js';
import { createPrisma } from './lib/prisma.js';
import { createAuthRouter } from './routes/auth.js';
import { createUserRouter } from './routes/users.js';
import { createNewsRouter } from './routes/news.js';
import { createRankRouter } from './routes/ranks.js';
import { createVersionRouter } from './routes/versions.js';
import { createModRouter } from './routes/mods.js';
import { createUpdateRouter } from './routes/update.js';
import { createServerBrowserRouter } from './routes/servers.js';
import { authMiddleware, adminOnly } from './middleware/auth.js';
import { launcherKeyMiddleware } from './middleware/launcher-key.js';

const config = loadConfig();
const prisma = createPrisma(config.databaseUrl);
const app = express();

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

const launcherAuth = launcherKeyMiddleware(config.launcherKey);
const auth = authMiddleware(config.jwtSecret);

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', version: '1.0.0', launcher: 'Astro Launcher' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/auth', launcherAuth, createAuthRouter(prisma, config.jwtSecret));
app.use('/api/users', launcherAuth, createUserRouter(prisma, config.jwtSecret));
app.use('/api/news', launcherAuth, createNewsRouter(prisma, config.jwtSecret));
app.use('/api/ranks', launcherAuth, createRankRouter(prisma, config.jwtSecret));
app.use('/api/versions', launcherAuth, createVersionRouter(prisma, config.jwtSecret));
app.use('/api/mods', launcherAuth, createModRouter(prisma, config.jwtSecret));
app.use('/api/update', createUpdateRouter());
app.use('/api/servers', launcherAuth, createServerBrowserRouter(prisma, config.jwtSecret));

const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Astro API running on port ${PORT}`);
});

export { app, prisma };
