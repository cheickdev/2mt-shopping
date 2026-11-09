"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseFcfa, formatFcfa } from "@/lib/money";
import LocationPicker from "@/components/LocationPicker";
import { DELIVERY_TIERS, MAX_DELIVERY_KM, type LatLng } from "@/lib/delivery";

export interface SettingsData {
  shopName: string;
  whatsapp: string;
  deliveryFee: number;
  partnerAPct: number;
  adBudget: number;
  ownerName: string;
  partnerName: string;
  shopLat: number | null;
  shopLng: number | null;
}

export default function SettingsForm({ initial }: { initial: SettingsData }) {
  const router = useRouter();
  const [shopName, setShopName] = useState(initial.shopName);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [deliveryFee, setDeliveryFee] = useState(String(initial.deliveryFee));
  const [partnerAPct, setPartnerAPct] = useState(String(initial.partnerAPct));
  const [adBudget, setAdBudget] = useState(String(initial.adBudget));
  const [ownerName, setOwnerName] = useState(initial.ownerName);
  const [partnerName, setPartnerName] = useState(initial.partnerName);
  const [shopPoint, setShopPoint] = useState<LatLng | null>(
    initial.shopLat != null && initial.shopLng != null ? { lat: initial.shopLat, lng: initial.shopLng } : null
  );
  const [ownerPassword, setOwnerPassword] = useState("");
  const [partnerPassword, setPartnerPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        shopName: shopName.trim(),
        whatsapp,
        deliveryFee: parseFcfa(deliveryFee),
        partnerAPct: Math.min(100, Math.max(0, parseInt(partnerAPct, 10) || 0)),
        adBudget: parseFcfa(adBudget),
        ownerName: ownerName.trim() || "Propriétaire",
        partnerName: partnerName.trim() || "Partenaire",
        shopLat: shopPoint ? shopPoint.lat : null,
        shopLng: shopPoint ? shopPoint.lng : null,
      };
      if (ownerPassword.trim()) payload.ownerPassword = ownerPassword.trim();
      if (partnerPassword.trim()) payload.partnerPassword = partnerPassword.trim();

      const res = await fetch("/api/admin/parametres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setOwnerPassword("");
      setPartnerPassword("");
      setMsg(data.passwordChanged ? "Enregistré ✓ — si vous avez changé VOTRE mot de passe, reconnectez-vous." : "Enregistré ✓");
      router.refresh();
    } catch {
      setError("Erreur réseau");
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
        <span className="note">Ex. Mali : 223 + votre numéro (sans le +, sans espaces).</span>
      </div>
      <div className="field">
        <label>Point de départ des livraisons</label>
        <LocationPicker value={shopPoint} onChange={setShopPoint} pinLabel="Départ" height={280} />
        <span className="note">
          {shopPoint
            ? "Le prix de la livraison est calculé selon la distance entre ce point et l'adresse du client."
            : "Pas encore réglé : touchez la carte à l'endroit d'où partent les livraisons (ou « Ma position actuelle »), puis Enregistrer."}
        </span>
        <span className="note">
          Tarifs : {DELIVERY_TIERS.map((t, i) => `${i === 0 ? "0" : DELIVERY_TIERS[i - 1].maxKm}–${t.maxKm} km : ${formatFcfa(t.fee)}`).join(" · ")} · plus de {MAX_DELIVERY_KM} km : à convenir.
        </span>
        {shopPoint && (
          <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => setShopPoint(null)}>
            Effacer le point
          </button>
        )}
      </div>
      <div className="field">
        <label>Frais de livraison par défaut (FCFA)</label>
        <input className="input" inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
        <span className="note">Utilisés seulement si le point de départ n'est pas réglé.</span>
      </div>
      <div className="field">
        <label>Dépenses pub du mois (FCFA)</label>
        <input className="input" inputMode="numeric" value={adBudget} onChange={(e) => setAdBudget(e.target.value)} />
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "6px 0" }} />
      <h3 style={{ margin: "0 0 4px" }}>Les associés</h3>

      <div className="field">
        <label>Nom du propriétaire (vous)</label>
        <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Ex. Moussa" />
      </div>
      <div className="field">
        <label>Part du bénéfice — propriétaire (%)</label>
        <input className="input" inputMode="numeric" value={partnerAPct} onChange={(e) => setPartnerAPct(e.target.value)} />
        <span className="note">Propriétaire : {parseInt(partnerAPct, 10) || 0}% · Partenaire : {pctB}%</span>
      </div>
      <div className="field">
        <label>Nouveau mot de passe du propriétaire</label>
        <input className="input" type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" autoComplete="new-password" />
      </div>

      <div className="field">
        <label>Nom de la partenaire</label>
        <input className="input" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Ex. Awa" />
      </div>
      <div className="field">
        <label>Nouveau mot de passe de la partenaire</label>
        <input className="input" type="password" value={partnerPassword} onChange={(e) => setPartnerPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" autoComplete="new-password" />
        <span className="note">Donnez ce mot de passe à votre partenaire pour qu'elle se connecte.</span>
      </div>

      <button className="btn block" disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
      {msg && <div className="success" style={{ textAlign: "center" }}>{msg}</div>}
      {error && <div className="error">{error}</div>}
    </form>
  );
}
