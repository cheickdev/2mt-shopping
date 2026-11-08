"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart";
import { formatFcfa } from "@/lib/money";

export default function CartView({ deliveryFee, whatsapp }: { deliveryFee: number; whatsapp: string }) {
  const router = useRouter();
  const { items, total, setQty, remove, clear, ready } = useCart();
  const [form, setForm] = useState({ customerName: "", customerPhone: "", quartier: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grandTotal = total + (items.length ? deliveryFee : 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/commande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.map((i) => ({ productId: i.productId, variant: i.variant, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }
      clear();
      router.push(`/commande/${data.publicId}`);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <p className="note" style={{ marginTop: 24 }}>Chargement du panier…</p>;

  if (items.length === 0) {
    return (
      <div className="card" style={{ padding: 24, marginTop: 20, textAlign: "center" }}>
        <p style={{ marginTop: 0 }}>Votre panier est vide.</p>
        <a className="btn" href="/">Voir les articles</a>
      </div>
    );
  }

  const waText = encodeURIComponent(
    "Bonjour 2MT - Shopping 👋\nJe veux commander :\n" +
      items.map((i) => `• ${i.name}${i.variant ? " (" + i.variant + ")" : ""} x${i.quantity} — ${formatFcfa(i.price * i.quantity)}`).join("\n") +
      `\n\nTotal articles : ${formatFcfa(total)}\n\nMon nom : \nMon quartier : `
  );
  const waHref = whatsapp ? `https://wa.me/${whatsapp}?text=${waText}` : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, marginTop: 20 }}>
      <div>
        <h1 style={{ marginTop: 0 }}>Mon panier</h1>
        <div>
          {items.map((i) => (
            <div className="cart-row" key={i.key}>
              {i.image ? (
                <img className="ci-thumb" src={i.image} alt={i.name} />
              ) : (
                <div className="ci-thumb" />
              )}
              <div className="ci-main">
                <div className="ci-name">{i.name}</div>
                {i.variant && <div className="ci-meta">Option : {i.variant}</div>}
                <div className="ci-meta">{formatFcfa(i.price)} l'unité</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <div className="qty">
                    <button type="button" onClick={() => setQty(i.key, i.quantity - 1)} aria-label="Moins">–</button>
                    <span>{i.quantity}</span>
                    <button type="button" onClick={() => setQty(i.key, i.quantity + 1)} aria-label="Plus">+</button>
                  </div>
                  <button type="button" className="btn ghost sm" onClick={() => remove(i.key)}>Retirer</button>
                </div>
              </div>
              <div className="price">{formatFcfa(i.price * i.quantity)}</div>
            </div>
          ))}
        </div>
      </div>

      <form className="summary" onSubmit={submit}>
        <div className="line"><span>Articles</span><strong>{formatFcfa(total)}</strong></div>
        <div className="line"><span>Livraison (Bamako)</span><strong>{formatFcfa(deliveryFee)}</strong></div>
        <div className="line total"><span>Total à payer</span><span>{formatFcfa(grandTotal)}</span></div>
        <p className="note" style={{ margin: "2px 0 8px" }}>💵 Paiement à la livraison (espèces).</p>

        <div className="field">
          <label htmlFor="n">Votre nom</label>
          <input id="n" className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Ex. Awa Traoré" required />
        </div>
        <div className="field">
          <label htmlFor="t">Téléphone (WhatsApp de préférence)</label>
          <input id="t" className="input" inputMode="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="Ex. 76 00 00 00" required />
        </div>
        <div className="field">
          <label htmlFor="q">Quartier / zone de livraison</label>
          <input id="q" className="input" value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} placeholder="Ex. Faladié, Hamdallaye, Kalaban…" required />
        </div>
        <div className="field">
          <label htmlFor="no">Note (optionnel)</label>
          <textarea id="no" className="input" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Repère, heure préférée…" />
        </div>

        <button className="btn block" disabled={loading}>
          {loading ? "Envoi…" : `Valider la commande — ${formatFcfa(grandTotal)}`}
        </button>
        {waHref && (
          <a className="btn wa block" href={waHref} target="_blank" rel="noopener noreferrer">Ou commander sur WhatsApp</a>
        )}
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
