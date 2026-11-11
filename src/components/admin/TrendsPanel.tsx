"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatFcfa } from "@/lib/money";
import type { TrendItem } from "@/lib/trends";
import type { LocalAd, LocalTerm } from "@/lib/coinafrique";

// Categories CoinAfrique Mali lues (voir lib/coinafrique).
const BAMAKO_CATS = [
  { slug: "cosmetique-et-parfums", label: "Cosmétiques & parfums" },
  { slug: "chaussures-femme", label: "Chaussures femme" },
  { slug: "chaussures-homme", label: "Chaussures homme" },
  { slug: "accessoires-cheveux-coiffure-et-cils", label: "Cheveux, coiffure & cils" },
];

/** Annonce CoinAfrique -> meme forme qu'un produit tendance (grille commune). */
const adToItem = (a: LocalAd): TrendItem => ({
  title: a.title,
  imageUrl: a.imageUrl,
  price: a.price ? `${nf.format(a.price)} FCFA` : "",
  priceFcfa: a.price || null,
  source: `CoinAfrique Mali${a.age ? ` · il y a ${a.age}` : ""}`,
  link: a.link,
  rating: null,
  ratingCount: null,
  score: 0,
});
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

// Reperer des produits en tendance (a Bamako via CoinAfrique, ou Google Shopping) et garder ceux qui
// interessent dans une liste « Produits a venir ».
export default function TrendsPanel({ categories, onClose }: { categories: string[]; onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"chercher" | "avenir">("chercher");
  const [source, setSource] = useState<"bamako" | "google">("bamako");
  const [cat, setCat] = useState(BAMAKO_CATS[0].slug);
  const [terms, setTerms] = useState<LocalTerm[]>([]);
  const [meta, setMeta] = useState<{ total: number; oldestDays: number; count: number } | null>(null);
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
  const [preview, setPreview] = useState<number | null>(null); // produit ouvert en grand

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

  // A Bamako : chargement automatique de la categorie choisie.
  useEffect(() => {
    if (source === "bamako") searchBamako("", cat);
    else setResults(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, cat]);

  async function searchBamako(term: string, category = cat) {
    const t = term.trim();
    setQ(t);
    setLastQ(t);
    setError(null);
    setInfo(null);
    setResults(null);
    setPicked(new Set());
    setBusy("Lecture des annonces de Bamako…");
    try {
      const d = await (await fetch(`/api/admin/tendances-bamako?cat=${encodeURIComponent(category)}&q=${encodeURIComponent(t)}`)).json();
      if (!d.ok) setError(d.error ?? "Recherche impossible.");
      else {
        setResults((d.results as LocalAd[]).map(adToItem));
        setTerms(d.terms);
        setMeta({ total: d.total, oldestDays: d.oldestDays, count: d.count });
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setBusy(null);
    }
  }

  async function search(term: string) {
    if (source === "bamako") return searchBamako(term);
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
          <div className="tr-source">
            <button className={`btn sm ${source === "bamako" ? "" : "ghost"}`} onClick={() => setSource("bamako")}>🇲🇱 À Bamako</button>
            <button className={`btn sm ${source === "google" ? "" : "ghost"}`} onClick={() => setSource("google")}>🌍 Google Shopping</button>
          </div>
          {source === "bamako" ? (
            <>
              <p className="note" style={{ margin: "0 0 8px" }}>
                Ce que les vendeurs proposent le plus <strong>à Bamako</strong>, d'après les annonces récentes de CoinAfrique Mali
                {meta ? ` (${meta.total} annonces${meta.oldestDays ? `, ${meta.oldestDays >= 60 ? `${Math.round(meta.oldestDays / 30)} derniers mois` : `${meta.oldestDays} derniers jours`}` : ""})` : ""}. Quand beaucoup
                de vendeurs proposent un produit, c'est qu'il se vend.
              </p>
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie" style={{ marginBottom: 8 }}>
                {BAMAKO_CATS.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
              <form
                className="imp-url"
                onSubmit={(e) => {
                  e.preventDefault();
                  searchBamako(q);
                }}
              >
                <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer : gel douche, Naomi, argan…" />
                <button className="btn sm" disabled={!!busy}>{q.trim() ? "Chercher" : "Tout voir"}</button>
              </form>
              {terms.length > 0 && (
                <div className="tr-terms">
                  <span className="note">{lastQ ? `Avec « ${lastQ} », on trouve surtout :` : "🔥 Les plus proposés à Bamako :"}</span>
                  <div className="tr-terms-list">
                    {terms.map((t, i) => (
                      <button key={t.term} type="button" className="tr-term" onClick={() => searchBamako(lastQ ? `${lastQ} ${t.term}` : t.term)} disabled={!!busy}>
                        <span className="tr-term-rank">{i + 1}</span>
                        <span className="tr-term-name">{t.term}</span>
                        <span className="tr-term-n">
                          {t.count} annonces{t.medianPrice ? ` · ~${formatFcfa(t.medianPrice)}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {meta && lastQ && <p className="note" style={{ margin: "0 0 8px" }}>{meta.count} annonce{meta.count > 1 ? "s" : ""} pour « {lastQ} » (les plus récentes d'abord).</p>}
            </>
          ) : (
            <>
              <p className="note" style={{ margin: "0 0 8px" }}>
                Les produits les plus populaires sur Google Shopping France (les plus notés et commentés).
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
                  {suggestions.map((sg) => (
                    <button key={sg} type="button" className="tr-sugg-chip" onClick={() => search(sg)} disabled={!!busy}>
                      {sg}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {busy && <p className="note">{busy}</p>}
          {results && results.length === 0 && <p className="note">Aucun produit trouvé pour « {lastQ} ». Essayez un autre mot.</p>}
          {results && results.length > 0 && (
            <>
              <div className="tr-grid">
                {results.map((r, i) => (
                  <div key={i} className={`tr-item ${picked.has(i) ? "on" : ""}`}>
                    <button type="button" className="tr-pick" onClick={() => toggle(i)} aria-pressed={picked.has(i)} aria-label={`Sélectionner ${r.title}`}>
                      <span className="tr-img">
                        <SafeImg key={r.imageUrl} src={r.imageUrl} />
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
                    <button type="button" className="tr-view" onClick={() => setPreview(i)}>👁 Voir</button>
                  </div>
                ))}
              </div>
              {preview !== null && results[preview] && (
                <TrendPreview
                  item={results[preview]}
                  picked={picked.has(preview)}
                  onToggle={() => toggle(preview)}
                  onClose={() => setPreview(null)}
                />
              )}
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
              <span className="tr-row-img">{u.imageUrl ? <SafeImg src={u.imageUrl} /> : null}</span>
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

/**
 * Photo d'un autre site. On essaie dans l'ordre : `big` (grande taille, si
 * fournie), la photo normale, puis la photo normale via le relais du serveur.
 */
function SafeImg({ src, big, alt = "" }: { src: string; big?: string; alt?: string }) {
  const chain = [...(big && big !== src ? [big] : []), src, proxied(src)];
  const [i, setI] = useState(0);
  if (!src) return null;
  return (
    <img
      src={chain[i]}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setI((n) => Math.min(n + 1, chain.length - 1))}
    />
  );
}

/** CoinAfrique : la miniature « thumb_… » existe aussi en grande taille. */
const bigImage = (u: string) => (/images\.coinafrique\.com\/thumb_/.test(u) ? u.replace("/thumb_", "/") : undefined);

/** Fiche en grand d'un produit tendance. */
function TrendPreview({ item, picked, onToggle, onClose }: { item: TrendItem; picked: boolean; onToggle: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = o;
    };
  }, [onClose]);
  const site = item.link ? new URL(item.link).hostname.replace(/^www\./, "") : "";
  return createPortal(
    <div className="tr-modal" role="dialog" aria-modal="true" aria-label={item.title} onClick={onClose}>
      <div className="tr-modal-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="tr-modal-x" onClick={onClose} aria-label="Fermer">✕</button>
        <div className="tr-modal-img">
          <SafeImg src={item.imageUrl} big={bigImage(item.imageUrl)} alt={item.title} />
        </div>
        <h3 style={{ margin: "4px 0" }}>{item.title}</h3>
        {item.rating != null && (
          <div className="tr-rating" style={{ fontSize: 14 }}>
            ★ {item.rating.toFixed(1)} / 5{item.ratingCount ? ` · ${nf.format(item.ratingCount)} avis` : ""}
          </div>
        )}
        <div className="tr-price" style={{ fontSize: 20 }}>
          {item.price || "Prix non indiqué"}
          {item.priceFcfa && !/f\s?cfa/i.test(item.price) ? <span className="note"> ≈ {formatFcfa(item.priceFcfa)}</span> : null}
        </div>
        {item.source && <div className="note">{item.source}</div>}
        <div className="tr-modal-actions">
          <button type="button" className={`btn ${picked ? "ghost" : ""}`} onClick={onToggle}>
            {picked ? "✓ Sélectionné (retirer)" : "✓ Sélectionner"}
          </button>
          {item.link && (
            <a className="btn ghost" href={item.link} target="_blank" rel="noopener noreferrer">
              Voir l'annonce{site ? ` sur ${site}` : ""} ↗
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
