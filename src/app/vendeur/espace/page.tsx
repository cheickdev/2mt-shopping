import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentVendor } from "@/lib/vendors";
import { getAllCategories } from "@/lib/categories";
import { galleryOf } from "@/lib/gallery";
import VendorSpace, { VendorProductRow } from "@/components/vendor/VendorSpace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mon espace vendeur", robots: { index: false } };

export default async function VendorSpacePage() {
  const me = await currentVendor();
  if (!me) redirect("/vendeur/connexion");
  const [vendor, products, categories] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: me.id }, select: { freeUntil: true } }),
    prisma.product.findMany({
      where: { vendorId: me.id, archived: false },
      orderBy: { createdAt: "desc" },
      include: { images: { orderBy: { position: "asc" } } },
    }),
    getAllCategories(),
  ]);
  const rows: VendorProductRow[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    description: p.description,
    price: p.price,
    stock: p.stock,
    sizes: p.sizes,
    gallery: galleryOf(p),
    active: p.active,
    status: p.status as VendorProductRow["status"],
    rejectReason: p.rejectReason,
  }));
  return (
    <VendorSpace
      vendor={{ name: me.name, slug: me.slug, maxProducts: me.maxProducts, freeUntil: vendor?.freeUntil?.toISOString() ?? null }}
      products={rows}
      categories={categories}
    />
  );
}
