import type { Request, Response, NextFunction } from 'express';

const LAUNCHER_KEY_HEADER = 'x-astro-key';

export function launcherKeyMiddleware(validKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const providedKey = req.headers[LAUNCHER_KEY_HEADER] as string | undefined;
    if (!providedKey || providedKey !== validKey) {
      res.status(401).json({ error: 'Invalid launcher key' });
      return;
    }
    next();
  };
}
