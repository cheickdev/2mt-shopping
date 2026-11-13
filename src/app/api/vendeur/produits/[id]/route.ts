import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentVendor } from "@/lib/vendors";
import { vendorProductSchema } from "@/lib/vendor-product";
import { galleryOf, saveGallery } from "@/lib/gallery";

export const dynamic = "force-dynamic";

const patchSchema = vendorProductSchema.partial().extend({ active: z.boolean().optional() });

async function own(id: string) {
  const me = await currentVendor();
  if (!me) return { me: null, p: null };
  const p = await prisma.product.findFirst({ where: { id, vendorId: me.id }, include: { images: { orderBy: { position: "asc" } } } });
  return { me, p };
}

// Modifier son produit. Changer seulement le prix, le stock ou « en vente » ne
// demande pas de nouvelle validation ; changer le nom, les photos, la
// description… le remet « en attente ».
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, p } = await own(id);
  if (!me) return NextResponse.json({ ok: false, error: "Connectez-vous." }, { status: 401 });
  if (!p) return NextResponse.json({ ok: false, error: "Produit introuvable." }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  const d = parsed.data;

  const changed = (k: "name" | "category" | "description" | "sizes") => d[k] !== undefined && d[k] !== p[k];
  const galleryChanged = d.gallery !== undefined && JSON.stringify(d.gallery) !== JSON.stringify(galleryOf(p));
  const needsReview = changed("name") || changed("category") || changed("description") || changed("sizes") || galleryChanged;

  await prisma.product.update({
    where: { id },
    data: {
      name: d.name,
      category: d.category,
      description: d.description,
      sizes: d.sizes,
      price: d.price,
      stock: d.stock,
      active: d.active,
      ...(needsReview ? { status: "PENDING", rejectReason: "" } : {}),
    },
  });
  if (galleryChanged && d.gallery) await saveGallery(id, d.gallery);
  return NextResponse.json({ ok: true, pending: needsReview || p.status === "PENDING" });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, p } = await own(id);
  if (!me) return NextResponse.json({ ok: false, error: "Connectez-vous." }, { status: 401 });
  if (!p) return NextResponse.json({ ok: false, error: "Produit introuvable." }, { status: 404 });
  // Deja commande par le passe ? on archive au lieu d'effacer.
  const used = await prisma.orderItem.count({ where: { productId: id } }).catch(() => 0);
  if (used) await prisma.product.update({ where: { id }, data: { archived: true, active: false } });
  else await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
