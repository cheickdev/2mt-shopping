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
  // Plusieurs photos par produit.
  `CREATE TABLE IF NOT EXISTS "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId")`,
  // Lien avec la caisse Alimentation Tounkara.
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "caisseRef" TEXT`,
  `CREATE TABLE IF NOT EXISTS "CaisseProduct" (
    "ref" TEXT NOT NULL,
    "barcode" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaisseProduct_pkey" PRIMARY KEY ("ref")
  )`,
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
