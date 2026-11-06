import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { formatMoney } from "@/lib/pricing";
import { paymentMode } from "@/lib/cinetpay";
import { providerMode } from "@/lib/providers/dhru";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

const PAID = ["PAID", "PROCESSING", "DELIVERED", "REFUNDED"];

export default async function AdminDashboard() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [totalOrders, delivered, failed, refunded, sums, recent] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.order.count({ where: { status: "FAILED" } }),
    prisma.order.count({ where: { status: "REFUNDED" } }),
    prisma.order.aggregate({
      where: { status: { in: PAID } },
      _sum: { priceCents: true, costCents: true },
    }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const revenue = sums._sum.priceCents ?? 0;
  const cost = sums._sum.costCents ?? 0;
  const margin = revenue - cost;

  return (
    <AdminShell>
      <h1>Tableau de bord</h1>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">Chiffre d&apos;affaires</div><div className="kpi-val">{formatMoney(revenue)}</div></div>
        <div className="kpi"><div className="kpi-label">Marge</div><div className="kpi-val" style={{ color: "var(--brand-2)" }}>{formatMoney(margin)}</div></div>
        <div className="kpi"><div className="kpi-label">Commandes</div><div className="kpi-val">{totalOrders}</div></div>
        <div className="kpi"><div className="kpi-label">Livrees</div><div className="kpi-val">{delivered}</div></div>
        <div className="kpi"><div className="kpi-label">Echecs</div><div className="kpi-val" style={{ color: "var(--danger)" }}>{failed}</div></div>
        <div className="kpi"><div className="kpi-label">Remboursees</div><div className="kpi-val">{refunded}</div></div>
      </div>

      <div className="mode-row">
        <span className={`mode-pill ${paymentMode() === "live" ? "on" : "off"}`}>
          Paiement : {paymentMode() === "live" ? "CinetPay (live)" : "simulation"}
        </span>
        <span className={`mode-pill ${providerMode() === "live" ? "on" : "off"}`}>
          Fournisseur : {providerMode() === "live" ? "DHRU (live)" : "simulation"}
        </span>
      </div>

      <h2 className="section-title" style={{ marginTop: 32 }}>Commandes recentes</h2>
      <table className="table">
        <thead>
          <tr><th>Reference</th><th>Service</th><th>IMEI</th><th>Statut</th><th>Prix</th></tr>
        </thead>
        <tbody>
          {recent.map((o) => (
            <tr key={o.id}>
              <td><a href="/admin/orders">{o.publicId}</a></td>
              <td>{o.serviceName}</td>
              <td className="mono">{o.imei}</td>
              <td><span className={`status-pill status-${o.status}`}>{o.status}</span></td>
              <td>{formatMoney(o.priceCents, o.currency)}</td>
            </tr>
          ))}
          {recent.length === 0 && (
            <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Aucune commande pour l&apos;instant.</td></tr>
          )}
        </tbody>
      </table>
    </AdminShell>
  );
}
