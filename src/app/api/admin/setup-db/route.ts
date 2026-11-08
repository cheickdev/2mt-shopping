import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Cree les tables Postgres (idempotent) + quelques produits d'exemple.
// Permet d'initialiser la base en 1 clic depuis l'admin, sans manipuler le
// moteur de migration (qui ne tourne pas dans notre environnement de build).
const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product"("slug")`,
  `CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Order_publicId_key" ON "Order"("publicId")`,
  `CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "variant" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId")`,
  `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variantId" TEXT`,
  `CREATE TABLE IF NOT EXISTS "Variant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageData" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "Variant_productId_idx" ON "Variant"("productId")`,
  `CREATE TABLE IF NOT EXISTS "Setting" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "shopName" TEXT NOT NULL DEFAULT '2MT - Shopping',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "deliveryFee" INTEGER NOT NULL DEFAULT 1000,
    "partnerAPct" INTEGER NOT NULL DEFAULT 60,
    "adBudget" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
  )`,
];

const SAMPLE = [
  { name: "Escarpins vernis rouge", category: "Chaussures", price: 15000, cost: 9000, stock: 8, sizes: "37,38,39,40", featured: true, description: "Escarpins elegants, talon 8 cm. Parfaits pour les sorties et ceremonies." },
  { name: "Serum eclat visage", category: "Cosmétiques", price: 8000, cost: 4500, stock: 20, sizes: "", featured: true, description: "Serum hydratant pour une peau lumineuse." },
];

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });

  try {
    for (const sql of DDL) await prisma.$executeRawUnsafe(sql);

    await prisma.setting.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });

    // N'ajoute les exemples que si la boutique est vide (ne reinjecte pas apres coup).
    const count = await prisma.product.count();
    if (count === 0) {
      for (const p of SAMPLE) {
        await prisma.product.upsert({ where: { slug: slugify(p.name) }, update: {}, create: { slug: slugify(p.name), ...p } });
      }
    }

    return NextResponse.json({ ok: true, products: await prisma.product.count() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Échec de l'initialisation : ${(err as Error).message}` }, { status: 500 });
  }
}
