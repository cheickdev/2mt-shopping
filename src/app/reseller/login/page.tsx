"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResellerLogin() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/reseller/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Echec de connexion.");
        return;
      }
      router.push("/reseller");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 460, margin: "80px auto", padding: "0 20px" }}>
      <h1>Espace revendeur</h1>
      <p style={{ color: "var(--muted)" }}>Connectez-vous avec votre cle API.</p>
      <form className="card" onSubmit={submit} style={{ marginTop: 16 }}>
        <div className="field">
          <label>Cle API</label>
          <input
            className="input"
            placeholder="rk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoFocus
          />
        </div>
        <button className="btn" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
        {error && <div className="error">{error}</div>}
      </form>
    </main>
  );
}
