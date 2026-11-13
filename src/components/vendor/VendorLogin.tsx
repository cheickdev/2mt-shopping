"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VendorLogin() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/vendeur/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erreur.");
        return;
      }
      router.push("/vendeur/espace");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "50px auto 0" }}>
      <h1 style={{ textAlign: "center" }}>Espace vendeur</h1>
      <p className="note" style={{ textAlign: "center" }}>Vendez vos articles sur 2MT - Shopping</p>
      <form className="summary" onSubmit={submit} style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="vid">Votre numéro WhatsApp</label>
          <input id="vid" className="input" inputMode="tel" placeholder="Ex. 76 12 34 56" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="vpw">Mot de passe</label>
          <input id="vpw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn block" disabled={loading}>{loading ? "…" : "Se connecter"}</button>
        {error && <div className="error">{error}</div>}
      </form>
      <p className="note" style={{ textAlign: "center", marginTop: 14 }}>
        Pas encore vendeur ? Contactez 2MT - Shopping sur WhatsApp pour ouvrir votre compte.
      </p>
      <p className="note" style={{ textAlign: "center" }}>
        <a href="/vendeur/conditions">Lire les conditions vendeurs</a>
      </p>
    </div>
  );
}
