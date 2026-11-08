import { redirect } from "next/navigation";
import { currentRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import AdminShell from "../AdminShell";
import OrdersManager, { OrderRow } from "@/components/admin/OrdersManager";

export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");

  const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });
  const rows: OrderRow[] = orders.map((o) => ({
    publicId: o.publicId,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    quartier: o.quartier,
    note: o.note,
    status: o.status,
    itemsTotal: o.itemsTotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((it) => ({ id: it.id, name: it.name, variant: it.variant, quantity: it.quantity, price: it.price })),
  }));

  return (
    <AdminShell owner={role === "owner"}>
      <h1>Commandes</h1>
      <p className="note" style={{ marginTop: 0 }}>Suivez et faites avancer chaque commande, et contactez le client en un clic.</p>
      <OrdersManager orders={rows} />
    </AdminShell>
  );
}
