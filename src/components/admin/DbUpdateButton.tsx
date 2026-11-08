"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DbUpdateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/setup-db", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setMsg("Base à jour ✓");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="summary" style={{ maxWidth: 480, marginTop: 24 }}>
      <h3 style={{ marginTop: 0 }}>Maintenance</h3>
      <p className="note" style={{ marginTop: 0 }}>
        Après une mise à jour de l'application, cliquez ici pour ajouter les nouveautés à la base
        de données (par exemple la gestion des variétés). Sans danger, peut être relancé.
      </p>
      <button className="btn ghost" onClick={run} disabled={loading}>
        {loading ? "Mise à jour…" : "Mettre à jour la base de données"}
      </button>
      {msg && <div className="success" style={{ marginTop: 10 }}>{msg}</div>}
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
