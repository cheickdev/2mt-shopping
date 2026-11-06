"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  type: string;
  category: string;
  description: string;
  priceCents: number;
  costCents: number;
  estimatedTime: string;
  dhruServiceId: string | null;
  active: boolean;
}

const eur = (cents: number) => (cents / 100).toFixed(2);
const toCents = (eurStr: string) => Math.round(parseFloat(eurStr.replace(",", ".")) * 100) || 0;
const marginPct = (p: number, c: number) => (p > 0 ? Math.round(((p - c) / p) * 100) : 0);

function Row({ s }: { s: ServiceRow }) {
  const router = useRouter();
  const [price, setPrice] = useState(eur(s.priceCents));
  const [cost, setCost] = useState(eur(s.costCents));
  const [time, setTime] = useState(s.estimatedTime);
  const [dhru, setDhru] = useState(s.dhruServiceId ?? "");
  const [active, setActive] = useState(s.active);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const pc = toCents(price);
  const cc = toCents(cost);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/services/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceCents: pc,
          costCents: cc,
          estimatedTime: time,
          dhruServiceId: dhru.trim() === "" ? null : dhru.trim(),
          active,
        }),
      });
      const data = await res.json();
      setMsg(data.ok ? "Enregistre ✓" : data.error ?? "Erreur");
      if (data.ok) router.refresh();
    } catch {
      setMsg("Erreur reseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>
        <strong>{s.name}</strong>
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{s.slug} · {s.type}</div>
      </td>
      <td><input className="input sm" value={price} onChange={(e) => setPrice(e.target.value)} /></td>
      <td><input className="input sm" value={cost} onChange={(e) => setCost(e.target.value)} /></td>
      <td style={{ fontWeight: 700, color: "var(--brand-2)" }}>{marginPct(pc, cc)}%</td>
      <td><input className="input sm" value={time} onChange={(e) => setTime(e.target.value)} /></td>
      <td><input className="input sm" placeholder="—" value={dhru} onChange={(e) => setDhru(e.target.value)} /></td>
      <td>
        <label className="switch">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {active ? "Actif" : "Inactif"}
        </label>
      </td>
      <td>
        <button className="btn sm" onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
        {msg && <div style={{ fontSize: 12, marginTop: 4, color: "var(--muted)" }}>{msg}</div>}
      </td>
    </tr>
  );
}

function CreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ slug: "", name: "", type: "CHECK", category: "", price: "", cost: "", time: "Instantane" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: f.slug.trim(),
          name: f.name.trim(),
          type: f.type,
          category: f.category.trim() || "Autre",
          description: "",
          priceCents: toCents(f.price),
          costCents: toCents(f.cost),
          estimatedTime: f.time.trim() || "Instantane",
          active: true,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setF({ slug: "", name: "", type: "CHECK", category: "", price: "", cost: "", time: "Instantane" });
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erreur reseau");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return <button className="btn sm" style={{ width: "auto", marginTop: 16 }} onClick={() => setOpen(true)}>+ Nouveau service</button>;
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Nouveau service</h3>
      <div className="create-grid">
        <input className="input sm" placeholder="slug (ex. unlock-huawei)" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
        <input className="input sm" placeholder="Nom affiche" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className="select sm" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="CHECK">Verification</option>
          <option value="UNLOCK">Deblocage</option>
        </select>
        <input className="input sm" placeholder="Categorie" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <input className="input sm" placeholder="Prix €" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <input className="input sm" placeholder="Cout €" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
        <input className="input sm" placeholder="Delai" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn sm" style={{ width: "auto" }} onClick={create} disabled={saving}>{saving ? "…" : "Creer"}</button>
        <button className="btn sm ghost" style={{ width: "auto" }} onClick={() => setOpen(false)}>Annuler</button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default function ServicesManager({ initial }: { initial: ServiceRow[] }) {
  return (
    <>
      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr><th>Service</th><th>Prix €</th><th>Cout €</th><th>Marge</th><th>Delai</th><th>ID fournisseur</th><th>Statut</th><th></th></tr>
        </thead>
        <tbody>
          {initial.map((s) => <Row key={s.id} s={s} />)}
        </tbody>
      </table>
      <CreateForm />
    </>
  );
}
