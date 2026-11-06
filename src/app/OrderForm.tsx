"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ServiceOption {
  slug: string;
  name: string;
  priceLabel: string;
}

export default function OrderForm({
  services,
  paymentLive,
  defaultEmail = "",
}: {
  services: ServiceOption[];
  paymentLive: boolean;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [serviceSlug, setServiceSlug] = useState(services[0]?.slug ?? "");
  const [imei, setImei] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceSlug, imei, email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }
      // Mode paiement live : le prestataire renvoie une URL de paiement -> on y redirige.
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      // Mode simulation : la commande est deja traitee -> page de suivi.
      router.push(`/order/${data.publicId}`);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={submit}>
      <div className="field">
        <label>Service</label>
        <select className="select" value={serviceSlug} onChange={(e) => setServiceSlug(e.target.value)}>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name} — {s.priceLabel}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>IMEI (composez *#06# sur le telephone)</label>
        <input
          className="input"
          inputMode="numeric"
          placeholder="15 chiffres"
          value={imei}
          onChange={(e) => setImei(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Email (pour recevoir le resultat)</label>
        <input
          className="input"
          type="email"
          placeholder="vous@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <button className="btn" disabled={loading}>
        {loading ? "Traitement…" : paymentLive ? "Payer et commander" : "Lancer la commande"}
      </button>

      {error && <div className="error">{error}</div>}
      <div className="note">
        {paymentLive
          ? "Paiement securise : Mobile Money (Orange, Moov) ou carte bancaire."
          : "Mode simulation : commande traitee instantanement, sans paiement reel."}
      </div>
    </form>
  );
}
