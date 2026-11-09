import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { galleryField, saveGallery } from "@/lib/gallery";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).max(40).optional(),
  description: z.string().optional(),
  price: z.number().int().nonnegative().optional(),
  cost: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  sizes: z.string().optional(),
  imageData: z.string().nullable().optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
  gallery: galleryField.optional(), // toutes les photos (la 1re = principale)
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  }
  if (parsed.data.imageData && parsed.data.imageData.length > 1_800_000) {
    return NextResponse.json({ ok: false, error: "Image trop lourde." }, { status: 400 });
  }

  const { gallery, ...fields } = parsed.data;
  try {
    await prisma.product.update({ where: { id }, data: fields });
    if (gallery) await saveGallery(id, gallery);
  } catch {
    return NextResponse.json({ ok: false, error: "Produit introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// Suppression DEFINITIVE du produit (et de ses variétés). L'historique des
// commandes garde le nom/prix figés, donc il n'est pas affecté.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.$transaction([
      prisma.orderItem.updateMany({ where: { productId: id }, data: { productId: null } }),
      prisma.variant.deleteMany({ where: { productId: id } }),
      prisma.productImage.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);
  } catch {
    return NextResponse.json({ ok: false, error: "Produit introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
