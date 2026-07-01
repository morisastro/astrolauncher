import { PrismaClient } from '@prisma/client';

export function createPrisma(databaseUrl: string): PrismaClient {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  return prisma;
}
