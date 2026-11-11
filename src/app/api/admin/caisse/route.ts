import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { MAX_CAISSE_PRODUCTS } from "@/lib/caisse-file";

export const dynamic = "force-dynamic";

// Lien avec la caisse « Alimentation Tounkara » (application du magasin).
// POST : remplace la liste des produits de la caisse (fichier d'export).
// GET  : recherche dans cette liste, en signalant ce qui est deja sur le site.

const row = z.object({
  ref: z.string().min(1).max(80),
  barcode: z.string().max(80).default(""),
  name: z.string().min(1).max(200),
  category: z.string().max(100).default(""),
  description: z.string().max(2000).default(""),
  price: z.number().int().min(0).max(100_000_000),
  cost: z.number().int().min(0).max(100_000_000),
  stock: z.number().int().min(-1_000_000).max(10_000_000),
  unit: z.string().max(30).default(""),
});
const body = z.object({ products: z.array(row).min(1, "Le fichier ne contient aucun produit.").max(MAX_CAISSE_PRODUCTS) });

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Fichier trop gros ou illisible." }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Fichier invalide." }, { status: 400 });
  }
  // Une reference = un produit (en cas de doublon, le dernier gagne).
  const byRef = new Map(parsed.data.products.map((p) => [p.ref, p]));
  const list = [...byRef.values()];
  const now = new Date();
  await prisma.$transaction(
    async (tx) => {
      await tx.caisseProduct.deleteMany({});
      for (let i = 0; i < list.length; i += 1000) {
        await tx.caisseProduct.createMany({ data: list.slice(i, i + 1000).map((p) => ({ ...p, updatedAt: now })) });
      }
    },
    { timeout: 60_000 }
  );
  return NextResponse.json({ ok: true, count: list.length });
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const words = q.split(/\s+/).filter(Boolean).slice(0, 6);

  const [count, last] = await Promise.all([
    prisma.caisseProduct.count(),
    prisma.caisseProduct.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  const found = await prisma.caisseProduct.findMany({
    where: {
      AND: words.map((w) => ({
        OR: [
          { name: { contains: w, mode: "insensitive" as const } },
          { category: { contains: w, mode: "insensitive" as const } },
          { barcode: { contains: w } },
        ],
      })),
    },
    orderBy: { name: "asc" },
    take: 40,
  });
  const linked = found.length
    ? await prisma.product.findMany({
        where: { caisseRef: { in: found.map((p) => p.ref) } },
        select: { caisseRef: true, name: true, archived: true },
      })
    : [];
  const onSite = new Map(linked.map((p) => [p.caisseRef, p]));
  return NextResponse.json({
    ok: true,
    count,
    updatedAt: last?.updatedAt ?? null,
    results: found.map((p) => ({ ...p, onSite: onSite.get(p.ref)?.name ?? null })),
  });
}
