"use client";

import { useState } from "react";

interface ProviderService {
  id: string;
  name: string;
  credit: string;
  time: string;
  group: string;
}

export default function ProviderCatalog() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ProviderService[] | null>(null);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/provider-services");
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erreur");
        setServices(null);
        return;
      }
      setServices(data.services);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard indisponible : l'ID reste visible a l'ecran */
    }
  }

  const filtered =
    services?.filter((s) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        s.group.toLowerCase().includes(needle) ||
        s.id.includes(needle)
      );
    }) ?? [];

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn sm" style={{ width: "auto" }} onClick={load} disabled={loading}>
          {loading ? "Chargement…" : services ? "Rafraichir la liste" : "Charger le catalogue"}
        </button>
        {services && (
          <input
            className="input sm"
            style={{ width: 280 }}
            placeholder="Filtrer (nom, groupe, ID)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
        {services && (
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {filtered.length} / {services.length} services
          </span>
        )}
      </div>

      {error && (
        <div className="error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {services && (
        <table className="table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>ID fournisseur</th>
              <th>Service</th>
              <th>Groupe</th>
              <th>Cout (credits)</th>
              <th>Delai</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={`${s.group}-${s.id}`}>
                <td>
                  <button
                    className="btn sm ghost"
                    style={{ width: "auto", fontFamily: "monospace" }}
                    onClick={() => copyId(s.id)}
                    title="Copier l'ID"
                  >
                    {copied === s.id ? "Copie ✓" : s.id}
                  </button>
                </td>
                <td><strong>{s.name}</strong></td>
                <td style={{ color: "var(--muted)" }}>{s.group}</td>
                <td>{s.credit}</td>
                <td style={{ color: "var(--muted)" }}>{s.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
