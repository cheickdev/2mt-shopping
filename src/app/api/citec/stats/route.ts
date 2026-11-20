// Chiffres pour le site mere CITEC (admin.citec.app) : totaux seulement, aucune donnee
// de client. Protege par la cle CITEC_STATS_KEY (Authorization: Bearer ...).
import { prisma } from "@/lib/db";
import { safeEqual } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = process.env.CITEC_STATS_KEY ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (key.length < 16 || !safeEqual(got, key)) return Response.json({ ok: false }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sixMonths = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const day30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [monthOrders, toHandle, delivered, vendors, products, pendingProducts, visitors] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: monthStart }, status: { not: "ANNULEE" } } }),
    prisma.order.count({ where: { status: { in: ["NOUVELLE", "CONFIRMEE", "EN_LIVRAISON"] } } }),
    prisma.order.findMany({ where: { status: "LIVREE", createdAt: { gte: sixMonths } }, select: { total: true, createdAt: true } }),
    prisma.vendor.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true, archived: false, status: "APPROVED" } }),
    prisma.product.count({ where: { status: "PENDING", archived: false } }),
    prisma.siteVisit.findMany({ where: { day: { gte: day30 } }, select: { visitor: true }, distinct: ["visitor"] }),
  ]);
  const byMonth = new Map<string, number>();
  for (const o of delivered) {
    const m = o.createdAt.toISOString().slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + o.total);
  }
  const thisMonth = now.toISOString().slice(0, 7);
  return Response.json({
    ok: true,
    kpis: [
      { label: "Ventes livrées", value: byMonth.get(thisMonth) ?? 0, format: "money", hint: "ce mois" },
      { label: "Commandes", value: monthOrders, format: "count", hint: "ce mois" },
      { label: "Commandes à traiter", value: toHandle, format: "count" },
      { label: "Vendeurs actifs", value: vendors, format: "count" },
      { label: "Produits en ligne", value: products, format: "count", hint: pendingProducts ? `${pendingProducts} à valider` : undefined },
      { label: "Visiteurs", value: visitors.length, format: "count", hint: "30 jours" },
    ],
    revenue: [...byMonth].map(([month, amount]) => ({ month, amount })),
  });
}
