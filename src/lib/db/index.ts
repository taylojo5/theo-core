import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Always cache the client to prevent connection pool exhaustion
// This is safe in all environments - the global cache prevents
// multiple instances during Next.js hot reloading (dev) and
// serverless cold starts (production)
globalForPrisma.prisma = db;

export type { PrismaClient } from "@prisma/client";
