"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatFcfa } from "@/lib/money";
import { formatKm, mapsLink } from "@/lib/delivery";

export interface OrderItemRow {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  price: number;
}
export interface OrderRow {
  publicId: string;
  customerName: string;
  customerPhone: string;
  quartier: string;
  note: string;
  status: string;
  itemsTotal: number;
  deliveryFee: number;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryKm: number | null;
  deliveryToConfirm: boolean;
  total: number;
  createdAt: string;
  items: OrderItemRow[];
}

const STATUSES = ["NOUVELLE", "CONFIRMEE", "EN_LIVRAISON", "LIVREE", "ANNULEE"];
const LABEL: Record<string, string> = {
  NOUVELLE: "Nouvelle",
  CONFIRMEE: "Confirmée",
  EN_LIVRAISON: "En livraison",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

function waNumber(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  // Numero malien a 8 chiffres -> prefixe 223.
  if (digits.length === 8) return "223" + digits;
  return digits;
}

function Card({ o }: { o: OrderRow }) {
  const router = useRouter();
  const [status, setStatus] = useState(o.status);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    setStatus(next);
    setSaving(true);
    try {
      await fetch(`/api/admin/commandes/${o.publicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const waText = encodeURIComponent(
    `Bonjour ${o.customerName} 👋 C'est 2MT - Shopping. Votre commande ${o.publicId} (${formatFcfa(o.total)}, paiement à la livraison). Nous organisons la livraison à ${o.quartier}.`
  );
  const waHref = `https://wa.me/${waNumber(o.customerPhone)}?text=${waText}`;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong>{o.publicId}</strong>
          <span className={`pill ${status}`} style={{ marginLeft: 8 }}>{LABEL[status] ?? status}</span>
        </div>
        <div className="note">{new Date(o.createdAt).toLocaleString("fr-FR")}</div>
      </div>

      <div style={{ margin: "10px 0", color: "var(--muted)", fontSize: 14 }}>
        <div><strong style={{ color: "var(--fg)" }}>{o.customerName}</strong> · {o.customerPhone}</div>
        <div>
          📍 {o.quartier}
          {o.deliveryKm != null && <> · {formatKm(o.deliveryKm)}</>}
          {o.deliveryLat != null && o.deliveryLng != null && (
            <>
              {" · "}
              <a href={mapsLink({ lat: o.deliveryLat, lng: o.deliveryLng })} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 600 }}>
                Voir sur la carte
              </a>
            </>
          )}
        </div>
        {o.note && <div>📝 {o.note}</div>}
      </div>

      <div style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "8px 0", margin: "6px 0" }}>
        {o.items.map((it) => (
          <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>{it.name}{it.variant ? ` (${it.variant})` : ""} × {it.quantity}</span>
            <span>{formatFcfa(it.price * it.quantity)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          <span>Livraison</span>
          <span>{o.deliveryToConfirm ? <strong style={{ color: "var(--warn)" }}>À convenir (trop loin)</strong> : formatFcfa(o.deliveryFee)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginTop: 4 }}>
          <span>Total</span><span>{formatFcfa(o.total)}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select className="select sm" value={status} onChange={(e) => change(e.target.value)} disabled={saving}>
          {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
        <a className="btn wa sm" href={waHref} target="_blank" rel="noopener noreferrer">WhatsApp client</a>
      </div>
    </div>
  );
}

export default function OrdersManager({ orders }: { orders: OrderRow[] }) {
  const [filter, setFilter] = useState("ACTIVES");
  const shown = orders.filter((o) => {
    if (filter === "ACTIVES") return o.status !== "LIVREE" && o.status !== "ANNULEE";
    if (filter === "TOUTES") return true;
    return o.status === filter;
  });

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {["ACTIVES", "NOUVELLE", "EN_LIVRAISON", "LIVREE", "TOUTES"].map((f) => (
          <button key={f} className={`btn ${filter === f ? "" : "ghost"} sm`} onClick={() => setFilter(f)}>
            {f === "ACTIVES" ? "À traiter" : f === "TOUTES" ? "Toutes" : LABEL[f] ?? f}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="note">Aucune commande dans cette vue.</p>
      ) : (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))" }}>
          {shown.map((o) => <Card key={o.publicId} o={o} />)}
        </div>
      )}
    </>
  );
}
