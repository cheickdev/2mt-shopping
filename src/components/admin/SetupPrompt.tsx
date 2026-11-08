"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPrompt() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function init() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/setup-db", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24, maxWidth: 520 }}>
      <h2 style={{ marginTop: 0 }}>Première mise en route</h2>
      <p className="note">
        La base de données est connectée mais pas encore initialisée. Cliquez ci-dessous
        pour créer les tables et quelques produits d'exemple. À ne faire qu'une seule fois.
      </p>
      <button className="btn" onClick={init} disabled={loading}>
        {loading ? "Initialisation…" : "Initialiser la base de données"}
      </button>
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
