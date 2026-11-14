import { redirect } from "next/navigation";
import { currentRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { galleryOf } from "@/lib/gallery";
import AdminShell from "../AdminShell";
import VendorsManager, { PendingRow, VendorRow } from "@/components/admin/VendorsManager";

export const dynamic = "force-dynamic";

export default async function AdminVendors() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "owner") redirect("/admin"); // reserve au proprietaire
  const settings = await getSettings();

  const [vendors, pending] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []),
    prisma.product
      .findMany({
        where: { vendorId: { not: null }, status: "PENDING", archived: false },
        orderBy: { createdAt: "asc" },
        include: { images: { orderBy: { position: "asc" } }, vendor: { select: { name: true } } },
      })
      .catch(() => []),
  ]);
  const counts = vendors.length
    ? await prisma.product.groupBy({ by: ["vendorId", "status"], where: { vendorId: { in: vendors.map((v) => v.id) }, archived: false }, _count: true })
    : [];
  const count = (id: string, status?: string) =>
    counts.filter((c) => c.vendorId === id && (!status || c.status === status)).reduce((s, c) => s + c._count, 0);

  const vendorRows: VendorRow[] = vendors.map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    whatsapp: v.whatsapp,
    description: v.description,
    active: v.active,
    maxProducts: v.maxProducts,
    freeUntil: v.freeUntil ? v.freeUntil.toISOString().slice(0, 10) : "",
    posLinked: !!v.posShopId,
    linkCode: v.linkCode ?? "",
    total: count(v.id),
    online: count(v.id, "APPROVED"),
    pending: count(v.id, "PENDING"),
  }));
  const pendingRows: PendingRow[] = pending.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    stock: p.stock,
    sizes: p.sizes,
    description: p.description,
    gallery: galleryOf(p),
    vendorName: p.vendor?.name ?? "",
  }));

  return (
    <AdminShell owner userName={settings.ownerName}>
      <h1>Vendeurs</h1>
      <p className="note" style={{ marginTop: 0 }}>
        Des vendeurs partenaires vendent sur votre site. Leurs clients les contactent sur <b>leur</b> WhatsApp ; leurs articles ne passent pas par votre panier.
        Chaque nouveau produit doit être validé par vous.
      </p>
      <VendorsManager vendors={vendorRows} pending={pendingRows} />
    </AdminShell>
  );
}
