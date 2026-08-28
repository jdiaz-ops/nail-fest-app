import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton: avoids exhausting Postgres connections
// from hot-reload creating a new PrismaClient on every file change.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
