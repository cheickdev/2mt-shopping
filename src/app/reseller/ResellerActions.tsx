"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/reseller/logout", { method: "POST" });
    router.push("/reseller/login");
    router.refresh();
  }
  return <button className="admin-logout" style={{ marginTop: 0 }} onClick={logout}>Se deconnecter</button>;
}

export function CopyKey({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible */
    }
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <code className="mono" style={{ background: "var(--bg-elev)", padding: "8px 12px", borderRadius: 8, fontSize: 13, wordBreak: "break-all" }}>
        {apiKey}
      </code>
      <button className="btn sm ghost" style={{ width: "auto" }} onClick={copy}>{copied ? "Copie ✓" : "Copier"}</button>
    </div>
  );
}

const PRESETS = [1000, 5000, 20000];

export function TopUp({ paymentLive }: { paymentLive: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState("50");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function topup(cents: number) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reseller/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.error ?? "Erreur");
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      router.refresh();
    } catch {
      setMsg("Erreur reseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {PRESETS.map((c) => (
          <button key={c} className="btn sm ghost" style={{ width: "auto" }} disabled={busy} onClick={() => topup(c)}>
            +{(c / 100).toFixed(0)} €
          </button>
        ))}
        <input className="input sm" style={{ maxWidth: 90 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button
          className="btn sm"
          style={{ width: "auto" }}
          disabled={busy}
          onClick={() => topup(Math.round((parseFloat(amount.replace(",", ".")) || 0) * 100))}
        >
          Recharger
        </button>
      </div>
      <div className="note" style={{ textAlign: "left", marginTop: 8 }}>
        {paymentLive ? "Paiement securise Stripe." : "Mode simulation : credit immediat, sans paiement reel."}
      </div>
      {msg && <div className="error">{msg}</div>}
    </div>
  );
}
