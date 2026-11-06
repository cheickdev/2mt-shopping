import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentReseller } from "@/lib/reseller-auth";
import { formatMoney } from "@/lib/pricing";
import { paymentMode } from "@/lib/cinetpay";
import { LogoutButton, CopyKey, TopUp } from "./ResellerActions";

export const dynamic = "force-dynamic";

export default async function ResellerDashboard() {
  const reseller = await currentReseller();
  if (!reseller) redirect("/reseller/login");

  const [orders, txns, spentAgg] = await Promise.all([
    prisma.order.findMany({ where: { resellerId: reseller.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.walletTransaction.findMany({ where: { resellerId: reseller.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.order.aggregate({
      where: { resellerId: reseller.id, status: { in: ["PAID", "PROCESSING", "DELIVERED"] } },
      _sum: { priceCents: true },
      _count: true,
    }),
  ]);

  return (
    <main className="container" style={{ paddingBottom: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
        <h1 style={{ margin: 0 }}>Espace revendeur</h1>
        <LogoutButton />
      </div>
      <p style={{ color: "var(--muted)" }}>Bonjour {reseller.name}.</p>

      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">Solde portefeuille</div><div className="kpi-val">{formatMoney(reseller.balanceCents)}</div></div>
        <div className="kpi"><div className="kpi-label">Votre marge fournisseur</div><div className="kpi-val">{reseller.resellerMarginPercent}%</div></div>
        <div className="kpi"><div className="kpi-label">Commandes</div><div className="kpi-val">{spentAgg._count}</div></div>
        <div className="kpi"><div className="kpi-label">Depense totale</div><div className="kpi-val">{formatMoney(spentAgg._sum.priceCents ?? 0)}</div></div>
        <div className="kpi"><div className="kpi-label">Quota API</div><div className="kpi-val">{reseller.rateLimitPerMin}<span style={{ fontSize: 14, color: "var(--muted)" }}>/min</span></div></div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Recharger le portefeuille</h3>
        <TopUp paymentLive={paymentMode() === "live"} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Votre cle API</h3>
        <CopyKey apiKey={reseller.apiKey} />
        <h4 style={{ marginBottom: 6 }}>Exemple : passer une commande</h4>
        <div className="result-box">{`curl -X POST https://votre-domaine/api/v1/orders \\
  -H "Authorization: Bearer ${reseller.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"blacklist-status","imei":"356938035643809"}'`}</div>
        <p className="note" style={{ textAlign: "left" }}>
          Endpoints : GET /api/v1/services · POST /api/v1/orders · GET /api/v1/orders/:id · GET /api/v1/account
          <br />
          <a href="/api-docs">📖 Documentation complete de l&apos;API →</a>
        </p>
      </div>

      <h2 className="section-title">Commandes recentes</h2>
      <table className="table">
        <thead><tr><th>Reference</th><th>Service</th><th>IMEI</th><th>Statut</th><th>Prix</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="mono">{o.publicId}</td>
              <td>{o.serviceName}</td>
              <td className="mono">{o.imei}</td>
              <td><span className={`status-pill status-${o.status}`}>{o.status}</span></td>
              <td>{formatMoney(o.priceCents, o.currency)}</td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Aucune commande via l&apos;API pour l&apos;instant.</td></tr>}
        </tbody>
      </table>

      <h2 className="section-title">Mouvements de portefeuille</h2>
      <table className="table">
        <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Solde apres</th><th>Note</th></tr></thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.createdAt).toLocaleString("fr-FR")}</td>
              <td>{t.type}</td>
              <td style={{ color: t.amountCents < 0 ? "var(--danger)" : "var(--brand-2)" }}>{formatMoney(t.amountCents)}</td>
              <td>{formatMoney(t.balanceAfterCents)}</td>
              <td style={{ color: "var(--muted)" }}>{t.note}</td>
            </tr>
          ))}
          {txns.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Aucun mouvement.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
