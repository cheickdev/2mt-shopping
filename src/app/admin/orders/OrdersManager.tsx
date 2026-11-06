"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface OrderRow {
  publicId: string;
  serviceName: string;
  imei: string;
  email: string;
  status: string;
  priceCents: number;
  currency: string;
  resultText: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const money = (c: number, cur: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(c / 100);

function Row({ o }: { o: OrderRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function action(kind: "retry" | "refund") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${o.publicId}/${kind}`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) setMsg(data.error ?? "Erreur");
      else router.refresh();
    } catch {
      setMsg("Erreur reseau");
    } finally {
      setBusy(false);
    }
  }

  const canRetry = o.status === "FAILED" || o.status === "PROCESSING";
  const canRefund = ["PAID", "PROCESSING", "DELIVERED"].includes(o.status);

  return (
    <>
      <tr>
        <td className="mono">{o.publicId}</td>
        <td>{o.serviceName}</td>
        <td className="mono">{o.imei}</td>
        <td><span className={`status-pill status-${o.status}`}>{o.status}</span></td>
        <td>{money(o.priceCents, o.currency)}</td>
        <td>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn sm ghost" style={{ width: "auto" }} onClick={() => setOpen(!open)}>
              {open ? "Masquer" : "Details"}
            </button>
            {canRetry && (
              <button className="btn sm" style={{ width: "auto" }} onClick={() => action("retry")} disabled={busy}>Relancer</button>
            )}
            {canRefund && (
              <button className="btn sm danger" style={{ width: "auto" }} onClick={() => action("refund")} disabled={busy}>Rembourser</button>
            )}
          </div>
          {msg && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>{msg}</div>}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ background: "var(--bg-elev)" }}>
            <div style={{ fontSize: 13 }}>
              <div>Email : {o.email}</div>
              <div>Date : {new Date(o.createdAt).toLocaleString("fr-FR")}</div>
              {o.resultText && <div className="result-box" style={{ marginTop: 8 }}>{o.resultText}</div>}
              {o.errorMessage && <div className="error">{o.errorMessage}</div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function OrdersManager({ initial }: { initial: OrderRow[] }) {
  return (
    <table className="table" style={{ marginTop: 16 }}>
      <thead>
        <tr><th>Reference</th><th>Service</th><th>IMEI</th><th>Statut</th><th>Prix</th><th>Actions</th></tr>
      </thead>
      <tbody>
        {initial.map((o) => <Row key={o.publicId} o={o} />)}
        {initial.length === 0 && (
          <tr><td colSpan={6} style={{ color: "var(--muted)" }}>Aucune commande.</td></tr>
        )}
      </tbody>
    </table>
  );
}
