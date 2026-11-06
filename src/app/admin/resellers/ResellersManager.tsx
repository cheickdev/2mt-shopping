"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ResellerRow {
  id: string;
  name: string;
  email: string;
  maskedKey: string;
  balanceCents: number;
  marginPercent: number;
  rateLimitPerMin: number;
  active: boolean;
}

const money = (c: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(c / 100);

function Row({ r }: { r: ResellerRow }) {
  const router = useRouter();
  const [margin, setMargin] = useState(String(r.marginPercent));
  const [rate, setRate] = useState(String(r.rateLimitPerMin));
  const [active, setActive] = useState(r.active);
  const [adjust, setAdjust] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/resellers/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) setMsg(data.error ?? "Erreur");
      else {
        setAdjust("");
        router.refresh();
      }
    } catch {
      setMsg("Erreur reseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <strong>{r.name}</strong>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.email}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{r.maskedKey}</div>
      </td>
      <td>{money(r.balanceCents)}</td>
      <td>
        <div style={{ display: "flex", gap: 6 }}>
          <input className="input sm" style={{ maxWidth: 70 }} placeholder="± €" value={adjust} onChange={(e) => setAdjust(e.target.value)} />
          <button
            className="btn sm ghost"
            style={{ width: "auto" }}
            disabled={busy}
            onClick={() => patch({ adjustCents: Math.round((parseFloat(adjust.replace(",", ".")) || 0) * 100) })}
          >
            Ajuster
          </button>
        </div>
      </td>
      <td>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input className="input sm" style={{ maxWidth: 60 }} value={margin} onChange={(e) => setMargin(e.target.value)} />%
          <button className="btn sm ghost" style={{ width: "auto" }} disabled={busy} onClick={() => patch({ resellerMarginPercent: parseInt(margin) || 0 })}>OK</button>
        </div>
      </td>
      <td>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input className="input sm" style={{ maxWidth: 70 }} value={rate} onChange={(e) => setRate(e.target.value)} />/min
          <button className="btn sm ghost" style={{ width: "auto" }} disabled={busy} onClick={() => patch({ rateLimitPerMin: parseInt(rate) || 1 })}>OK</button>
        </div>
      </td>
      <td>
        <label className="switch">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked);
              patch({ active: e.target.checked });
            }}
          /> {active ? "Actif" : "Inactif"}
        </label>
        {msg && <div style={{ fontSize: 12, color: "var(--danger)" }}>{msg}</div>}
      </td>
    </tr>
  );
}

function CreateForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", margin: "30", balance: "" });
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/resellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name.trim(),
          email: f.email.trim(),
          resellerMarginPercent: parseInt(f.margin) || 30,
          initialBalanceCents: Math.round((parseFloat(f.balance.replace(",", ".")) || 0) * 100),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setNewKey(data.reseller.apiKey);
      setF({ name: "", email: "", margin: "30", balance: "" });
      router.refresh();
    } catch {
      setError("Erreur reseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>Nouveau revendeur</h3>
      <div className="create-grid">
        <input className="input sm" placeholder="Nom / societe" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input sm" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="input sm" placeholder="Marge %" value={f.margin} onChange={(e) => setF({ ...f, margin: e.target.value })} />
        <input className="input sm" placeholder="Solde initial €" value={f.balance} onChange={(e) => setF({ ...f, balance: e.target.value })} />
      </div>
      <button className="btn sm" style={{ width: "auto", marginTop: 12 }} disabled={busy} onClick={create}>{busy ? "…" : "Creer le revendeur"}</button>
      {error && <div className="error">{error}</div>}
      {newKey && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: "var(--brand-2)", fontSize: 14 }}>Revendeur cree. Communiquez-lui cette cle API (affichee une seule fois) :</div>
          <div className="result-box">{newKey}</div>
        </div>
      )}
    </div>
  );
}

export default function ResellersManager({ initial }: { initial: ResellerRow[] }) {
  return (
    <>
      <table className="table" style={{ marginTop: 16 }}>
        <thead><tr><th>Revendeur</th><th>Solde</th><th>Ajuster solde</th><th>Marge</th><th>Quota API</th><th>Statut</th></tr></thead>
        <tbody>
          {initial.map((r) => <Row key={r.id} r={r} />)}
          {initial.length === 0 && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>Aucun revendeur. Creez-en un ci-dessous.</td></tr>}
        </tbody>
      </table>
      <CreateForm />
    </>
  );
}
