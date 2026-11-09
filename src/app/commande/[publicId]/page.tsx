import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ma commande" };

const STATUS_LABEL: Record<string, string> = {
  NOUVELLE: "Reçue",
  CONFIRMEE: "Confirmée",
  EN_LIVRAISON: "En livraison",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function OrderPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const order = await prisma.order.findUnique({ where: { publicId }, include: { items: true } });
  if (!order) notFound();
  const settings = await getSettings();

  const waText = encodeURIComponent(
    `Bonjour 2MT - Shopping 👋\nJe suis ${order.customerName}, ma commande ${order.publicId}.\nJe voulais avoir des nouvelles 🙂`
  );
  const waHref = settings.whatsapp ? `https://wa.me/${settings.whatsapp}?text=${waText}` : null;

  return (
    <div style={{ maxWidth: 560, margin: "28px auto 0" }}>
      <div className="success" style={{ textAlign: "center", padding: "16px" }}>
        <div style={{ fontSize: 28 }}>✅</div>
        <h1 style={{ margin: "6px 0", fontSize: 22 }}>Commande reçue !</h1>
        <p style={{ margin: 0 }}>Nous vous appelons très vite pour confirmer la livraison.</p>
      </div>

      <div className="summary" style={{ marginTop: 18 }}>
        <div className="line">
          <span>Référence</span>
          <strong>{order.publicId}</strong>
        </div>
        <div className="line">
          <span>Statut</span>
          <span className={`pill ${order.status}`}>{STATUS_LABEL[order.status] ?? order.status}</span>
        </div>
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          {order.items.map((it) => (
            <div className="line" key={it.id} style={{ marginBottom: 4 }}>
              <span>
                {it.name}
                {it.variant ? ` (${it.variant})` : ""} × {it.quantity}
              </span>
              <strong>{formatFcfa(it.price * it.quantity)}</strong>
            </div>
          ))}
        </div>
        <div className="line">
          <span>Livraison</span>
          <strong>{order.deliveryToConfirm ? "À convenir" : formatFcfa(order.deliveryFee)}</strong>
        </div>
        <div className="line total">
          <span>Total à payer à la livraison{order.deliveryToConfirm ? " (hors livraison)" : ""}</span>
          <span>{formatFcfa(order.total)}</span>
        </div>
        {order.deliveryToConfirm && (
          <p className="note" style={{ margin: 0 }}>
            Votre adresse est éloignée : nous vous appelons pour convenir du prix de la livraison.
          </p>
        )}
        <p className="note" style={{ margin: 0 }}>
          Livraison à <strong>{order.quartier}</strong> · Tél : {order.customerPhone}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {waHref && (
          <a className="btn wa block" href={waHref} target="_blank" rel="noopener noreferrer">
            Nous écrire sur WhatsApp
          </a>
        )}
        <a className="btn ghost block" href="/">Continuer mes achats</a>
      </div>
      <p className="note" style={{ textAlign: "center", marginTop: 14 }}>
        Gardez votre référence <strong>{order.publicId}</strong> pour suivre la commande.
      </p>
    </div>
  );
}
