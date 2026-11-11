import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { galleryField, saveGallery } from "@/lib/gallery";
import { slugify, randomSuffix } from "@/lib/slug";

const schema = z.object({
  name: z.string().min(1, "Nom requis."),
  category: z.string().min(1, "Catégorie requise.").max(40),
  description: z.string().optional().default(""),
  price: z.number().int().nonnegative(),
  cost: z.number().int().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
  sizes: z.string().optional().default(""),
  imageData: z.string().nullable().optional(),
  gallery: galleryField.optional(), // toutes les photos (la 1re = principale)
  featured: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  caisseRef: z.string().max(80).nullable().optional(), // produit importe depuis la caisse
});

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  }
  const d = parsed.data;

  // Limite de taille de l'image (Data URL) pour ne pas gonfler la base.
  if (d.imageData && d.imageData.length > 1_800_000) {
    return NextResponse.json({ ok: false, error: "Image trop lourde. Réessayez avec une photo plus légère." }, { status: 400 });
  }

  let slug = slugify(d.name) || "article";
  if (await prisma.product.findUnique({ where: { slug } })) slug = `${slug}-${randomSuffix()}`;

  const product = await prisma.product.create({
    data: {
      slug,
      name: d.name,
      category: d.category,
      description: d.description ?? "",
      price: d.price,
      cost: d.cost ?? 0,
      stock: d.stock ?? 0,
      sizes: d.sizes ?? "",
      imageData: d.imageData ?? null,
      featured: d.featured ?? false,
      active: d.active ?? true,
      caisseRef: d.caisseRef || null,
    },
  });
  if (d.gallery) await saveGallery(product.id, d.gallery);
  return NextResponse.json({ ok: true, id: product.id });
}
