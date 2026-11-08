// Cree les tables SQLite + charge les donnees de depart, en passant par le
// CLIENT Prisma (moteur de requetes en memoire). Evite le "schema engine"
// (CLI) qui ne peut pas etre lance dans cet environnement.
//
// A n'utiliser qu'en DEV local. En production (Postgres), on utilise la
// migration/push Prisma normale.
const { PrismaClient } = require("@prisma/client");
try {
  if (typeof process.loadEnvFile === "function") process.loadEnvFile(".env");
} catch (e) {
  /* DATABASE_URL peut deja etre defini */
}

const prisma = new PrismaClient();

const DDL = [
  `CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sizes" TEXT NOT NULL DEFAULT '',
    "imageData" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product"("slug")`,
  `CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "quartier" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NOUVELLE',
    "paymentMethod" TEXT NOT NULL DEFAULT 'LIVRAISON',
    "itemsTotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Order_publicId_key" ON "Order"("publicId")`,
  `CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "variant" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId")`,
  `CREATE TABLE IF NOT EXISTS "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "shopName" TEXT NOT NULL DEFAULT '2MT - Shopping',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "deliveryFee" INTEGER NOT NULL DEFAULT 1000,
    "partnerAPct" INTEGER NOT NULL DEFAULT 60,
    "adBudget" INTEGER NOT NULL DEFAULT 0
  )`,
];

const PRODUCTS = [
  { name: "Escarpins vernis rouge", category: "CHAUSSURES", price: 15000, cost: 9000, stock: 8, sizes: "37,38,39,40", featured: true, description: "Escarpins elegants, talon 8 cm. Parfaits pour les sorties et ceremonies." },
  { name: "Baskets blanches tendance", category: "CHAUSSURES", price: 18000, cost: 11000, stock: 12, sizes: "38,39,40,41,42", featured: false, description: "Baskets confortables au quotidien, semelle souple." },
  { name: "Serum eclat visage", category: "COSMETIQUES", price: 8000, cost: 4500, stock: 20, sizes: "", featured: true, description: "Serum hydratant pour une peau lumineuse. Application matin et soir." },
  { name: "Rouge a levres mat (lot de 3)", category: "COSMETIQUES", price: 6000, cost: 3000, stock: 15, sizes: "Nude,Rouge,Bordeaux", featured: false, description: "Trois teintes longue tenue, fini mat." },
];

function slugify(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

(async () => {
  for (const sql of DDL) await prisma.$executeRawUnsafe(sql);

  await prisma.setting.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main", shopName: "2MT - Shopping", deliveryFee: 1000, partnerAPct: 60 },
  });

  for (const p of PRODUCTS) {
    await prisma.product.upsert({ where: { slug: slugify(p.name) }, update: {}, create: { slug: slugify(p.name), ...p } });
  }

  const n = await prisma.product.count();
  console.log("DB init OK — " + n + " produits.");
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
