"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erreur.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "60px auto 0" }}>
      <h1 style={{ textAlign: "center" }}>Tableau de bord</h1>
      <p className="note" style={{ textAlign: "center" }}>Espace réservé — 2MT Shopping</p>
      <form className="summary" onSubmit={submit} style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="pw">Mot de passe</label>
          <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <button className="btn block" disabled={loading}>{loading ? "…" : "Se connecter"}</button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
