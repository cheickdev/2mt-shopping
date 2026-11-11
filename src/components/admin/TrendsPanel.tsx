"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFcfa } from "@/lib/money";
import type { TrendItem } from "@/lib/trends";
import PrefilledProductForm from "@/components/admin/PrefilledProductForm";

interface Upcoming {
  id: string;
  name: string;
  imageUrl: string;
  price: string;
  priceFcfa: number | null;
  source: string;
  link: string;
  rating: number | null;
  ratingCount: number | null;
  query: string;
  note: string;
  createdAt: string;
}

const proxied = (u: string) => `/api/admin/import/image?url=${encodeURIComponent(u)}`;
const nf = new Intl.NumberFormat("fr-FR");

// Reperer des produits en tendance (Google Shopping) et garder ceux qui
// interessent dans une liste « Produits a venir ».
export default function TrendsPanel({ categories, onClose }: { categories: string[]; onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"chercher" | "avenir">("chercher");
  const [q, setQ] = useState("");
  const [lastQ, setLastQ] = useState("");
  const [results, setResults] = useState<TrendItem[] | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [creating, setCreating] = useState<Upcoming | null>(null);

  async function loadUpcoming() {
    try {
      const d = await (await fetch("/api/admin/a-venir")).json();
      if (d.ok) setUpcoming(d.list);
    } catch {
      /* hors ligne : on garde la liste actuelle */
    }
  }
  useEffect(() => {
    loadUpcoming();
  }, []);

  async function search(term: string) {
    const t = term.trim();
    if (t.length < 2) return;
    setQ(t);
    setLastQ(t);
    setError(null);
    setInfo(null);
    setResults(null);
    setPicked(new Set());
    setBusy("Recherche des tendances…");
    try {
      const d = await (await fetch(`/api/admin/tendances?q=${encodeURIComponent(t)}`)).json();
      if (!d.ok) setError(d.error ?? "Recherche impossible.");
      else {
        setResults(d.results);
        setSuggestions(d.suggestions);
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setBusy(null);
    }
  }

  function toggle(i: number) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  async function addPicked() {
    if (!results || !picked.size) return;
    setBusy("Ajout…");
    setError(null);
    try {
      const items = [...picked].map((i) => results[i]);
      const d = await (
        await fetch("/api/admin/a-venir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, query: lastQ }),
        })
      ).json();
      if (!d.ok) setError(d.error ?? "Ajout impossible.");
      else {
        setInfo(`✅ ${d.added} produit${d.added > 1 ? "s" : ""} ajouté${d.added > 1 ? "s" : ""} aux produits à venir${d.skipped ? ` (${d.skipped} déjà dans la liste)` : ""}.`);
        setPicked(new Set());
        loadUpcoming();
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setUpcoming((u) => u.filter((x) => x.id !== id));
    await fetch(`/api/admin/a-venir?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
  }

  async function saveNote(id: string, note: string) {
    setUpcoming((list) => list.map((x) => (x.id === id ? { ...x, note } : x)));
    await fetch("/api/admin/a-venir", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, note }) }).catch(() => null);
  }

  if (creating) {
    return (
      <PrefilledProductForm
        title={`📋 Créer « ${creating.name} »`}
        intro={
          <>
            Produit repéré dans les tendances{creating.source ? ` (${creating.source})` : ""}
            {creating.price ? ` — prix constaté : ${creating.price}${creating.priceFcfa ? ` ≈ ${formatFcfa(creating.priceFcfa)}` : ""}` : ""}. Indiquez{" "}
            <strong>votre</strong> prix de vente et votre coût d'achat.
          </>
        }
        initial={{ name: creating.name, category: "", price: 0, cost: 0, stock: 0, description: creating.note, photoUrl: creating.imageUrl || undefined }}
        onCancel={() => setCreating(null)}
        onCreated={(name) => {
          remove(creating.id);
          setCreating(null);
          setTab("avenir");
          setInfo(`✅ « ${name} » est maintenant sur le site et a été retiré des produits à venir.`);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="card imp" style={{ padding: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>🔥 Tendances</h3>
        <button className="btn ghost sm" onClick={onClose}>Fermer</button>
      </div>
      <div className="tr-tabs">
        <button className={`btn sm ${tab === "chercher" ? "" : "ghost"}`} onClick={() => setTab("chercher")}>🔥 Chercher</button>
        <button className={`btn sm ${tab === "avenir" ? "" : "ghost"}`} onClick={() => setTab("avenir")}>📋 Produits à venir ({upcoming.length})</button>
      </div>
      {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}
      {info && <div className="cats-ok">{info}</div>}

      {tab === "chercher" ? (
        <>
          <p className="note" style={{ margin: "0 0 8px" }}>
            Les produits les plus populaires sur Google Shopping (les plus notés et commentés). Cochez ceux qui vous intéressent.
          </p>
          <form
            className="imp-url"
            onSubmit={(e) => {
              e.preventDefault();
              search(q);
            }}
          >
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Thème : parfum homme, lait corporel…" />
            <button className="btn sm" disabled={!!busy || q.trim().length < 2}>Chercher</button>
          </form>
          <div className="tr-chips">
            {categories.map((c) => (
              <button key={c} type="button" className="cat-chip" onClick={() => search(c)} disabled={!!busy}>
                {c}
              </button>
            ))}
          </div>
          {suggestions.length > 0 && (
            <div className="tr-sugg">
              <span className="note">Recherches populaires :</span>
              {suggestions.map((s) => (
                <button key={s} type="button" className="tr-sugg-chip" onClick={() => search(s)} disabled={!!busy}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {busy && <p className="note">{busy}</p>}
          {results && results.length === 0 && <p className="note">Aucun produit trouvé pour « {lastQ} ». Essayez un autre mot.</p>}
          {results && results.length > 0 && (
            <>
              <div className="tr-grid">
                {results.map((r, i) => (
                  <button key={i} type="button" className={`tr-item ${picked.has(i) ? "on" : ""}`} onClick={() => toggle(i)} aria-pressed={picked.has(i)}>
                    <span className="tr-img">
                      <img src={r.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      {i < 3 && r.score > 0 && <span className="tr-rank">🔥 Top {i + 1}</span>}
                      <span className="tr-check">{picked.has(i) ? "✓" : ""}</span>
                    </span>
                    <span className="tr-title">{r.title}</span>
                    {r.rating != null && (
                      <span className="tr-rating">
                        ★ {r.rating.toFixed(1)}
                        {r.ratingCount ? ` · ${nf.format(r.ratingCount)} avis` : ""}
                      </span>
                    )}
                    <span className="tr-price">
                      {r.price}
                      {r.priceFcfa && !/f\s?cfa/i.test(r.price) ? <span className="note"> ≈ {formatFcfa(r.priceFcfa)}</span> : null}
                    </span>
                    {r.source && <span className="note tr-src">{r.source}</span>}
                  </button>
                ))}
              </div>
              <div className="tr-bar">
                <button className="btn block" onClick={addPicked} disabled={!picked.size || !!busy}>
                  {picked.size ? `📋 Ajouter ${picked.size} produit${picked.size > 1 ? "s" : ""} aux produits à venir` : "Touchez les produits qui vous intéressent"}
                </button>
              </div>
            </>
          )}
        </>
      ) : upcoming.length === 0 ? (
        <p className="note">Aucun produit à venir pour le moment. Cherchez des tendances et cochez ceux qui vous intéressent.</p>
      ) : (
        <div className="tr-list">
          {upcoming.map((u) => (
            <div key={u.id} className="tr-row">
              <span className="tr-row-img">{u.imageUrl ? <img src={proxied(u.imageUrl)} alt="" loading="lazy" /> : null}</span>
              <div className="tr-row-info">
                <strong>{u.name}</strong>
                <span className="note">
                  {[u.price && `${u.price}${u.priceFcfa && !/f\s?cfa/i.test(u.price) ? ` ≈ ${formatFcfa(u.priceFcfa)}` : ""}`, u.rating != null && `★ ${u.rating.toFixed(1)}${u.ratingCount ? ` (${nf.format(u.ratingCount)} avis)` : ""}`, u.source]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <input
                  className="input tr-note"
                  defaultValue={u.note}
                  placeholder="Note : fournisseur, prix d'achat, quantité…"
                  onBlur={(e) => e.target.value !== u.note && saveNote(u.id, e.target.value)}
                />
                <div className="tr-row-actions">
                  <button className="btn sm" onClick={() => setCreating(u)}>➕ Créer le produit</button>
                  {u.link && (
                    <a className="btn ghost sm" href={u.link} target="_blank" rel="noopener noreferrer">
                      Voir l'offre
                    </a>
                  )}
                  <button className="btn ghost sm" onClick={() => remove(u.id)}>Retirer</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
