"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart";
import { formatFcfa } from "@/lib/money";
import LocationPicker from "@/components/LocationPicker";
import { mapsLink, type LatLng } from "@/lib/delivery";

type Quote = { kind: "fee"; fee: number } | { kind: "contact" };

export default function CartView({
  whatsapp,
}: {
  whatsapp: string;
}) {
  const router = useRouter();
  const { items, total, setQty, remove, clear, ready } = useCart();
  const [form, setForm] = useState({ customerName: "", customerPhone: "", quartier: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);

  // Prix de la livraison demande au serveur (la distance n'est pas montree au client).
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  useEffect(() => {
    if (!location) return;
    const ctrl = new AbortController();
    setQuoting(true);
    fetch("/api/livraison", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(location),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setQuote(d.kind === "fee" ? { kind: "fee", fee: d.fee } : { kind: "contact" });
        else setQuote(null);
        setQuoting(false);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setQuoting(false);
      });
    return () => ctrl.abort();
  }, [location]);
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
          <span>Livraison</span>
          <strong>
            {quoting ? "Calcul…" : !quote ? "Choisissez l'adresse" : quote.kind === "fee" ? formatFcfa(quote.fee) : "À convenir"}
          </strong>
        </div>
        <div className="line total">
          <span>Total à payer{quote?.kind === "contact" ? " (hors livraison)" : ""}</span>
          <span>{formatFcfa(grandTotal)}</span>
        </div>
        <p className="note" style={{ margin: "2px 0 8px" }}>💵 Paiement à la livraison (espèces).</p>

        <div className="field">
          <label>Adresse de livraison</label>
          <LocationPicker value={location} onChange={setLocation} />
          {quote?.kind === "contact" ? (
            <div className="delivery-far">
              Votre adresse est éloignée : le prix de la livraison est à convenir avec le vendeur.
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

        <button className="btn block" disabled={loading || !location || quoting}>
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
