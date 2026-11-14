import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyRequest } from "@/lib/pos-link";
import { getAllCategories } from "@/lib/categories";
import { galleryField, saveGallery } from "@/lib/gallery";
import { slugify, randomSuffix } from "@/lib/slug";

export const dynamic = "force-dynamic";

const product = z.object({
  ref: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(40).default(""),
  description: z.string().max(2000).default(""),
  price: z.number().int().min(0),
  stock: z.number().int(),
  photoData: galleryField.element.optional(), // nouvelle photo (data URL), seulement quand elle change
});

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("link"), code: z.string().trim().min(4).max(20), posShopId: z.string().min(1).max(64) }),
  z.object({ type: z.literal("unlink"), posShopId: z.string().min(1).max(64) }),
  z.object({ type: z.literal("upsert"), posShopId: z.string().min(1).max(64), product }),
  z.object({ type: z.literal("remove"), posShopId: z.string().min(1).max(64), ref: z.string().min(1).max(64) }),
  z.object({ type: z.literal("status"), posShopId: z.string().min(1).max(64) }),
]);

const json = (data: Record<string, unknown>, status = 200) => NextResponse.json(data, { status });

// Appele uniquement par Simple Pos (requete signee).
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyRequest(req.headers, raw)) return json({ ok: false, error: "signature" }, 401);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "json" }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid" }, 400);
  const d = parsed.data;

  if (d.type === "link") {
    const v = await prisma.vendor.findFirst({ where: { linkCode: d.code.toUpperCase() } });
    if (!v) return json({ ok: false, error: "code" }, 404);
    if (!v.active) return json({ ok: false, error: "suspended" }, 403);
    await prisma.$transaction([
      prisma.vendor.updateMany({ where: { posShopId: d.posShopId, id: { not: v.id } }, data: { posShopId: null } }),
      prisma.vendor.update({ where: { id: v.id }, data: { posShopId: d.posShopId, linkCode: null } }),
    ]);
    return json({ ok: true, vendor: { name: v.name, slug: v.slug }, categories: await getAllCategories(), maxProducts: v.maxProducts });
  }

  const vendor = await prisma.vendor.findUnique({ where: { posShopId: d.posShopId } });
  if (!vendor) return json({ ok: false, error: "notLinked" }, 404);

  if (d.type === "unlink") {
    await prisma.$transaction([
      prisma.product.updateMany({ where: { vendorId: vendor.id, externalRef: { not: null } }, data: { active: false } }),
      prisma.vendor.update({ where: { id: vendor.id }, data: { posShopId: null } }),
    ]);
    return json({ ok: true });
  }

  if (d.type === "status") {
    // Etat de validation des produits (apres la decision du proprietaire de 2MT).
    const rows = await prisma.product.findMany({
      where: { vendorId: vendor.id, externalRef: { not: null }, archived: false },
      select: { externalRef: true, status: true, rejectReason: true, slug: true },
    });
    return json({ ok: true, products: rows.map((r) => ({ ref: r.externalRef, status: r.status, rejectReason: r.rejectReason, slug: r.slug })) });
  }

  if (d.type === "remove") {
    await prisma.product.updateMany({ where: { vendorId: vendor.id, externalRef: d.ref }, data: { active: false, archived: true } });
    return json({ ok: true });
  }

  // upsert
  if (!vendor.active) return json({ ok: false, error: "suspended" }, 403);
  const p = d.product;
  const existing = await prisma.product.findFirst({ where: { vendorId: vendor.id, externalRef: p.ref } });
  if (!existing) {
    const count = await prisma.product.count({ where: { vendorId: vendor.id, archived: false } });
    if (count >= vendor.maxProducts) return json({ ok: false, error: "limit", maxProducts: vendor.maxProducts }, 409);
    let slug = slugify(p.name) || "article";
    if (await prisma.product.findUnique({ where: { slug } })) slug = `${slug}-${randomSuffix()}`;
    const created = await prisma.product.create({
      data: {
        slug,
        name: p.name,
        category: p.category || "Divers",
        description: p.description,
        price: p.price,
        stock: Math.max(0, p.stock),
        vendorId: vendor.id,
        externalRef: p.ref,
        status: "PENDING",
        active: true,
      },
    });
    if (p.photoData) await saveGallery(created.id, [p.photoData]);
    return json({ ok: true, status: "PENDING", slug });
  }
  // Nom, categorie, description ou photo changes : nouvelle validation. Prix et stock : direct.
  const review =
    existing.name !== p.name || (p.category && existing.category !== p.category) || existing.description !== p.description || !!p.photoData || existing.archived;
  const updated = await prisma.product.update({
    where: { id: existing.id },
    data: {
      name: p.name,
      category: p.category || existing.category,
      description: p.description,
      price: p.price,
      stock: Math.max(0, p.stock),
      active: true,
      archived: false,
      ...(review ? { status: "PENDING", rejectReason: "" } : {}),
    },
  });
  if (p.photoData) await saveGallery(existing.id, [p.photoData]);
  return json({ ok: true, status: updated.status, slug: updated.slug, rejectReason: updated.rejectReason });
}
