import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "../AdminShell";
import OrdersManager, { OrderRow } from "./OrdersManager";

export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  if (!(await isAdmin())) redirect("/admin/login");

  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const rows: OrderRow[] = orders.map((o) => ({
    publicId: o.publicId,
    serviceName: o.serviceName,
    imei: o.imei,
    email: o.email,
    status: o.status,
    priceCents: o.priceCents,
    currency: o.currency,
    resultText: o.resultText,
    errorMessage: o.errorMessage,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <AdminShell>
      <h1>Commandes</h1>
      <p style={{ color: "var(--muted)" }}>100 dernieres commandes. Relancez un echec ou remboursez une commande.</p>
      <OrdersManager initial={rows} />
    </AdminShell>
  );
}
