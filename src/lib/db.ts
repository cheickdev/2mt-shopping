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
  // Notes des clients (etoiles).
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS "ProductRating" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductRating_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductRating_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ProductRating_productId_voterId_key" ON "ProductRating"("productId", "voterId")`,
  // Pixel Facebook (Meta).
  `ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "metaPixelId" TEXT NOT NULL DEFAULT ''`,
  // Statistiques de visite.
  `CREATE TABLE IF NOT EXISTS "SiteVisit" (
    "day" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT '',
    "mobile" BOOLEAN NOT NULL DEFAULT true,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("day", "visitor")
  )`,
  `CREATE TABLE IF NOT EXISTS "ProductVisit" (
    "day" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ProductVisit_pkey" PRIMARY KEY ("day", "productId", "visitor")
  )`,
  `CREATE INDEX IF NOT EXISTS "ProductVisit_productId_idx" ON "ProductVisit"("productId")`,
  // Espace vendeurs.
  `CREATE TABLE IF NOT EXISTS "Vendor" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "passHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxProducts" INTEGER NOT NULL DEFAULT 20,
    "freeUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_slug_key" ON "Vendor"("slug")`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "vendorId" TEXT`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'APPROVED'`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT NOT NULL DEFAULT ''`,
  `CREATE INDEX IF NOT EXISTS "Product_vendorId_idx" ON "Product"("vendorId")`,
  // Lien avec Simple Pos (gestion de stock des vendeurs).
  `ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "posShopId" TEXT`,
  `ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "linkCode" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_posShopId_key" ON "Vendor"("posShopId")`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "externalRef" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Product_externalRef_idx" ON "Product"("externalRef")`,
  // Gestion : comptes et operations.
  `CREATE TABLE IF NOT EXISTS "FinAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinAccount_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "FinEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "payee" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinEntry_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "FinEntry_date_idx" ON "FinEntry"("date")`,
  // Produits a venir (reperes dans les tendances).
  `CREATE TABLE IF NOT EXISTS "UpcomingProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "price" TEXT NOT NULL DEFAULT '',
    "priceFcfa" INTEGER,
    "source" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "rating" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "query" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpcomingProduct_pkey" PRIMARY KEY ("id")
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
