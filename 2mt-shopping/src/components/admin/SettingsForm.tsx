"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseFcfa } from "@/lib/money";

export interface SettingsData {
  shopName: string;
  whatsapp: string;
  deliveryFee: number;
  partnerAPct: number;
  adBudget: number;
}

export default function SettingsForm({ initial }: { initial: SettingsData }) {
  const router = useRouter();
  const [shopName, setShopName] = useState(initial.shopName);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [deliveryFee, setDeliveryFee] = useState(String(initial.deliveryFee));
  const [partnerAPct, setPartnerAPct] = useState(String(initial.partnerAPct));
  const [adBudget, setAdBudget] = useState(String(initial.adBudget));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/parametres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shopName.trim(),
          whatsapp,
          deliveryFee: parseFcfa(deliveryFee),
          partnerAPct: Math.min(100, Math.max(0, parseInt(partnerAPct, 10) || 0)),
          adBudget: parseFcfa(adBudget),
        }),
      });
      const data = await res.json();
      setMsg(data.ok ? "Enregistré ✓" : data.error ?? "Erreur");
      if (data.ok) router.refresh();
    } catch {
      setMsg("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  const pctB = 100 - (parseInt(partnerAPct, 10) || 0);

  return (
    <form className="summary" onSubmit={save} style={{ maxWidth: 480 }}>
      <div className="field">
        <label>Nom de la boutique</label>
        <input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} />
      </div>
      <div className="field">
        <label>Numéro WhatsApp des commandes (format international)</label>
        <input className="input" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="22376000000" />
        <span className="note">Ex. Mali : 223 + votre numéro (sans le +, sans espaces). Sert aux boutons « Commander sur WhatsApp ».</span>
      </div>
      <div className="field">
        <label>Frais de livraison Bamako (FCFA)</label>
        <input className="input" inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
      </div>
      <div className="field">
        <label>Partage du bénéfice — part associé A (%)</label>
        <input className="input" inputMode="numeric" value={partnerAPct} onChange={(e) => setPartnerAPct(e.target.value)} />
        <span className="note">Associé A : {parseInt(partnerAPct, 10) || 0}% · Associé B : {pctB}%</span>
      </div>
      <div className="field">
        <label>Dépenses pub du mois (FCFA)</label>
        <input className="input" inputMode="numeric" value={adBudget} onChange={(e) => setAdBudget(e.target.value)} />
        <span className="note">Déduit du bénéfice net dans le tableau de bord.</span>
      </div>
      <button className="btn block" disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
      {msg && <div className="note" style={{ textAlign: "center" }}>{msg}</div>}
    </form>
  );
}
