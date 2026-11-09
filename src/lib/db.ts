import { PrismaClient } from "@prisma/client";

// Colonnes ajoutees apres la creation de la base. Appliquees automatiquement
// (une fois par demarrage du serveur, avant la premiere requete) pour que le
// site marche juste apres un deploiement, sans devoir cliquer sur « Mettre a
// jour la base ». Idempotent : « IF NOT EXISTS ».
export const SCHEMA_UPGRADES: string[] = [
  // Livraison calculee selon la distance (carte).
  `ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "shopLat" DOUBLE PRECISION`,
  `ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "shopLng" DOUBLE PRECISION`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryLat" DOUBLE PRECISION`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryLng" DOUBLE PRECISION`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryKm" DOUBLE PRECISION`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryToConfirm" BOOLEAN NOT NULL DEFAULT false`,
];

function createClient() {
  const base = new PrismaClient();
  let upgraded: Promise<void> | null = null;

  const ensureSchema = (): Promise<void> => {
    if (!upgraded) {
      upgraded = (async () => {
        for (const sql of SCHEMA_UPGRADES) await base.$executeRawUnsafe(sql);
      })().catch(() => {
        // Base pas encore initialisee (tables absentes) : on reessaiera plus tard.
        upgraded = null;
      });
    }
    return upgraded ?? Promise.resolve();
  };

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          await ensureSchema();
          return query(args);
        },
      },
    },
  });
}

type Client = ReturnType<typeof createClient>;

// Reutilise une seule instance en dev pour eviter d'epuiser les connexions
// lors du rechargement a chaud de Next.js.
const globalForPrisma = globalThis as unknown as { prisma?: Client };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
