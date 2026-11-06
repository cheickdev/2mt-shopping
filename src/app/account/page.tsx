import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentCustomer } from "@/lib/customer-auth";
import { formatMoney } from "@/lib/pricing";
import { LogoutButton } from "./AccountForms";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  PENDING: "En attente", PAID: "Paye", PROCESSING: "En cours",
  DELIVERED: "Livre", FAILED: "Echec", REFUNDED: "Rembourse",
};

export default async function AccountPage() {
  const customer = await currentCustomer();
  if (!customer) redirect("/account/login");

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main style={{ paddingBottom: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
        <h1 style={{ margin: 0 }}>Mon compte</h1>
        <LogoutButton />
      </div>
      <p style={{ color: "var(--muted)" }}>{customer.name ? `${customer.name} · ` : ""}{customer.email}</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Mes commandes</h2>
        <a className="btn sm" style={{ width: "auto" }} href="/">Nouvelle commande</a>
      </div>

      <table className="table" style={{ marginTop: 12 }}>
        <thead><tr><th>Reference</th><th>Service</th><th>IMEI</th><th>Statut</th><th>Prix</th><th></th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="mono">{o.publicId}</td>
              <td>{o.serviceName}</td>
              <td className="mono">{o.imei}</td>
              <td><span className={`status-pill status-${o.status}`}>{LABELS[o.status] ?? o.status}</span></td>
              <td>{formatMoney(o.priceCents, o.currency)}</td>
              <td><a href={`/order/${o.publicId}`}>Voir</a></td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan={6} style={{ color: "var(--muted)" }}>Aucune commande pour l&apos;instant. <a href="/">Commencer</a>.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
