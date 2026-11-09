"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart";
import { formatFcfa } from "@/lib/money";
import LocationPicker from "@/components/LocationPicker";
import { quoteDelivery, formatKm, mapsLink, DELIVERY_TIERS, MAX_DELIVERY_KM, type LatLng } from "@/lib/delivery";

export default function CartView({
  deliveryFee,
  whatsapp,
  origin = null,
}: {
  deliveryFee: number;
  whatsapp: string;
  origin?: LatLng | null;
}) {
  const router = useRouter();
  const { items, total, setQty, remove, clear, ready } = useCart();
  const [form, setForm] = useState({ customerName: "", customerPhone: "", quartier: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);

  // Frais de livraison selon la distance (recalcules aussi par le serveur).
  const quote = location ? quoteDelivery(origin, location, deliveryFee) : null;
  const fee = quote?.kind === "fee" ? quote.fee : 0;
  const grandTotal = total + (items.length ? fee : 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!location) {
      setError("Choisissez votre adresse de livraison sur la carte.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/commande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          location,
          items: items.map((i) => ({ productId: i.productId, variant: i.variant, variantId: i.variantId ?? null, quantity: i.quantity })),
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
      `\n\nTotal articles : ${formatFcfa(total)}` +
      (location ? `\nMon adresse : ${mapsLink(location)}` : "") +
      `\n\nMon nom : \nMon quartier : `
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
        <div className="line">
          <span>Livraison{quote?.km != null ? ` (${formatKm(quote.km)})` : ""}</span>
          <strong>
            {!quote ? "Choisissez l'adresse" : quote.kind === "fee" ? formatFcfa(quote.fee) : "À convenir"}
          </strong>
        </div>
        <div className="line total">
          <span>Total à payer{quote?.kind === "contact" ? " (hors livraison)" : ""}</span>
          <span>{formatFcfa(grandTotal)}</span>
        </div>
        <p className="note" style={{ margin: "2px 0 8px" }}>💵 Paiement à la livraison (espèces).</p>

        <div className="field">
          <label>Adresse de livraison</label>
          <LocationPicker value={location} onChange={setLocation} origin={origin} />
          {quote?.kind === "contact" ? (
            <div className="delivery-far">
              Vous êtes à plus de {MAX_DELIVERY_KM} km : le prix de la livraison est à convenir avec le vendeur.
              Vous pouvez valider la commande, nous vous appellerons pour fixer le prix
              {whatsapp ? (
                <>
                  , ou{" "}
                  <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                    `Bonjour 2MT - Shopping 👋\nQuel est le prix de livraison jusqu'à mon adresse ? ${location ? mapsLink(location) : ""}`
                  )}`} target="_blank" rel="noopener noreferrer">contacter le vendeur sur WhatsApp</a>
                </>
              ) : null}
              .
            </div>
          ) : origin ? (
            <span className="note">
              Tarifs : {DELIVERY_TIERS.map((t, i) => `${i === 0 ? "0" : DELIVERY_TIERS[i - 1].maxKm}–${t.maxKm} km : ${formatFcfa(t.fee)}`).join(" · ")} · au-delà : à convenir.
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="n">Votre nom</label>
          <input id="n" className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Ex. Awa Traoré" required />
        </div>
        <div className="field">
          <label htmlFor="t">Téléphone (WhatsApp de préférence)</label>
          <input id="t" className="input" inputMode="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="Ex. 76 00 00 00" required />
        </div>
        <div className="field">
          <label htmlFor="q">Quartier / repère</label>
          <input id="q" className="input" value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} placeholder="Ex. Faladié, Hamdallaye, Kalaban…" required />
        </div>
        <div className="field">
          <label htmlFor="no">Note (optionnel)</label>
          <textarea id="no" className="input" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Repère, heure préférée…" />
        </div>

        <button className="btn block" disabled={loading || !location}>
          {loading ? "Envoi…" : !location ? "Choisissez votre adresse sur la carte" : `Valider la commande — ${formatFcfa(grandTotal)}`}
        </button>
        {waHref && (
          <a className="btn wa block" href={waHref} target="_blank" rel="noopener noreferrer">Ou commander sur WhatsApp</a>
        )}
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
