import { redirect } from "next/navigation";
import { currentRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/money";
import AdminShell from "./AdminShell";
import SetupPrompt from "@/components/admin/SetupPrompt";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  NOUVELLE: "Nouvelle",
  CONFIRMEE: "Confirmée",
  EN_LIVRAISON: "En livraison",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function AdminDashboard() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  const owner = role === "owner";

  // Si la base n'est pas encore initialisee (tables absentes), on propose de
  // l'initialiser en 1 clic plutot que d'afficher une erreur.
  let data;
  try {
    const [orders, productCount, lowStock, settings] = await Promise.all([
      prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } }),
      prisma.product.count({ where: { active: true } }),
      prisma.product.count({ where: { active: true, stock: { lte: 2 } } }),
      getSettings(),
    ]);
    data = { orders, productCount, lowStock, settings };
  } catch {
    return (
      <AdminShell owner={owner}>
        <h1>Tableau de bord</h1>
        {owner ? (
          <SetupPrompt />
        ) : (
          <p className="note">La base n&apos;est pas encore prête. Le propriétaire doit l&apos;initialiser.</p>
        )}
      </AdminShell>
    );
  }
  const { orders, productCount, lowStock, settings } = data;

  const nouvelles = orders.filter((o) => o.status === "NOUVELLE").length;
  const enCours = orders.filter((o) => o.status === "CONFIRMEE" || o.status === "EN_LIVRAISON").length;
  const livrees = orders.filter((o) => o.status === "LIVREE");

  const caLivre = livrees.reduce((s, o) => s + o.itemsTotal, 0);
  const beneficeBrut = livrees.reduce(
    (s, o) => s + o.items.reduce((si, it) => si + (it.price - it.cost) * it.quantity, 0),
    0
  );
  const beneficeNet = Math.max(0, beneficeBrut - settings.adBudget);
  const partA = Math.round((beneficeNet * settings.partnerAPct) / 100);
  const partB = beneficeNet - partA;

  const recent = orders.slice(0, 8);

  return (
    <AdminShell owner={owner}>
      <h1>Tableau de bord</h1>
      <p className="note" style={{ marginTop: 0 }}>Vue d'ensemble de 2MT - Shopping.</p>

      <div className="stat-row">
        <div className="stat"><div className="k">Nouvelles commandes</div><div className="v accent">{nouvelles}</div></div>
        <div className="stat"><div className="k">En cours</div><div className="v">{enCours}</div></div>
        <div className="stat"><div className="k">Livrées</div><div className="v">{livrees.length}</div></div>
        <div className="stat"><div className="k">CA livré</div><div className="v">{formatFcfa(caLivre)}</div></div>
      </div>

      <h2 style={{ marginBottom: 6 }}>Bénéfice & partage</h2>
      <p className="note" style={{ marginTop: 0 }}>
        Calculé sur les commandes <strong>livrées</strong>, moins les dépenses pub ({formatFcfa(settings.adBudget)} — modifiable dans Paramètres).
      </p>
      <div className="stat-row">
        <div className="stat"><div className="k">Bénéfice net</div><div className="v gold">{formatFcfa(beneficeNet)}</div></div>
        <div className="stat"><div className="k">Part associé A ({settings.partnerAPct}%)</div><div className="v">{formatFcfa(partA)}</div></div>
        <div className="stat"><div className="k">Part associé B ({100 - settings.partnerAPct}%)</div><div className="v">{formatFcfa(partB)}</div></div>
        <div className="stat"><div className="k">Produits actifs</div><div className="v">{productCount}{lowStock > 0 ? <span style={{ fontSize: 13, color: "var(--warn)", fontWeight: 600 }}> · {lowStock} stock faible</span> : null}</div></div>
      </div>

      <h2 style={{ marginBottom: 6 }}>Dernières commandes</h2>
      {recent.length === 0 ? (
        <p className="note">Aucune commande pour l'instant.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Réf.</th><th>Client</th><th>Quartier</th><th>Total</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td><a href="/admin/commandes" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>{o.publicId}</a></td>
                  <td>{o.customerName}<div className="note">{o.customerPhone}</div></td>
                  <td>{o.quartier}</td>
                  <td>{formatFcfa(o.total)}</td>
                  <td><span className={`pill ${o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
