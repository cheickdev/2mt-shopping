import { PrismaClient } from "@prisma/client";

// Reutilise une seule instance en dev pour eviter d'epuiser les connexions
// lors du rechargement a chaud de Next.js.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
