"use client";

import { useRef, useState } from "react";
import { fileToDataUrl, remoteToDataUrl } from "@/components/admin/imageResize";
import { detectBackground, type Background } from "@/components/admin/plainBackground";
import CutoutModal from "@/components/admin/CutoutModal";

export const MAX_PHOTOS = 8;

/** Ajoute des photos sans doublons, dans la limite autorisee. */
const merge = (a: string[], b: string[]) => [...new Set([...a, ...b])].slice(0, MAX_PHOTOS);

interface Result {
  url: string;
  thumb: string;
  title: string;
  source: string;
}

// Photos d'un produit : plusieurs photos, la 1re est la principale.
// Ajout depuis le telephone ou par recherche sur internet (nom du produit).
export default function GalleryEditor({
  value,
  onChange,
  searchName,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  searchName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cutFileRef = useRef<HTMLInputElement>(null);
  // Outil « Enlever le fond » : photo ouverte + photo a remplacer (index) ou ajout (null).
  const [cut, setCut] = useState<{ src: string; index: number | null } | null>(null);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Analyse des fonds : url -> resultat (undefined = en cours, null = analyse impossible).
  const [bgs, setBgs] = useState<Record<string, Background | null>>({});
  const [plainOnly, setPlainOnly] = useState(true);

  const room = MAX_PHOTOS - value.length;

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].slice(0, room);
    e.target.value = "";
    if (!files.length) return;
    setBusy("Préparation des photos…");
    try {
      const urls = await Promise.all(files.map((f) => fileToDataUrl(f)));
      onChange(merge(value, urls));
    } finally {
      setBusy(null);
    }
  }

  // Nouvelle photo a detourer (ex. photo d'etagere avec plusieurs produits).
  function onCutFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setCut({ src: URL.createObjectURL(f), index: null });
  }

  function closeCut() {
    if (cut?.src.startsWith("blob:")) URL.revokeObjectURL(cut.src);
    setCut(null);
  }

  function applyCut(url: string) {
    if (!cut) return;
    if (cut.index === null) onChange(merge(value, [url]));
    else onChange(value.map((v, j) => (j === cut.index ? url : v)));
    closeCut();
  }

  async function runSearch(term: string) {
    if (term.trim().length < 2) return;
    setError(null);
    setResults(null);
    setPicked([]);
    setBusy("Recherche…");
    try {
      const res = await fetch(`/api/admin/images?q=${encodeURIComponent(term.trim())}`);
      const d = await res.json();
      if (!d.ok) setError(d.error ?? "Recherche impossible.");
      else {
        setResults(d.results);
        analyse(d.results);
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setBusy(null);
    }
  }

  // Analyse chaque miniature (via le relais du serveur, sinon le navigateur
  // interdit de lire les pixels d'une image d'un autre site).
  function analyse(list: Result[]) {
    setBgs({});
    let i = 0;
    const next = async (): Promise<void> => {
      const r = list[i++];
      if (!r) return;
      let res: Background | null = null;
      try {
        res = await detectBackground(`/api/admin/import/image?url=${encodeURIComponent(r.thumb)}`);
      } catch {
        res = null;
      }
      setBgs((m) => ({ ...m, [r.url]: res }));
      return next();
    };
    // 4 analyses en parallele
    Promise.all([next(), next(), next(), next()]);
  }

  function openSearch() {
    setSearching(true);
    setQ(searchName);
    runSearch(searchName);
  }

  function togglePick(url: string) {
    setPicked((p) => (p.includes(url) ? p.filter((x) => x !== url) : p.length < room ? [...p, url] : p));
  }

  async function addPicked() {
    setError(null);
    const added: string[] = [];
    let failed = 0;
    for (let i = 0; i < picked.length; i++) {
      setBusy(`Téléchargement ${i + 1}/${picked.length}…`);
      try {
        added.push(await remoteToDataUrl(picked[i]));
      } catch {
        failed++;
      }
    }
    setBusy(null);
    if (added.length) onChange(merge(value, added));
    if (failed) setError(`${failed} image(s) n'ont pas pu être récupérées (site protégé). Choisissez-en d'autres.`);
    else {
      setSearching(false);
      setResults(null);
    }
    setPicked([]);
  }

  const move = (i: number, to: number) => {
    const v = [...value];
    const [x] = v.splice(i, 1);
    v.splice(to, 0, x);
    onChange(v);
  };

  return (
    <div className="gal">
      {value.length > 0 ? (
        <div className="gal-list">
          {value.map((src, i) => (
            <div key={i} className={`gal-item ${i === 0 ? "main" : ""}`}>
              <img src={src} alt="" />
              {i === 0 ? (
                <span className="gal-badge">Principale</span>
              ) : (
                <button type="button" className="gal-mk" onClick={() => move(i, 0)} title="Mettre en photo principale">
                  ★ Principale
                </button>
              )}
              <button type="button" className="gal-x" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Retirer la photo">
                ✕
              </button>
              <button type="button" className="gal-cut" onClick={() => setCut({ src, index: i })} title="Enlever le fond de cette photo" aria-label="Enlever le fond de cette photo">
                ✂️
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="note" style={{ margin: 0 }}>Aucune photo pour le moment.</p>
      )}

      {room > 0 ? (
        <div className="gal-actions">
          <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            📷 Depuis le téléphone
          </button>
          <button type="button" className="btn ghost sm" onClick={openSearch} disabled={!!busy || searchName.trim().length < 2}>
            🔎 Chercher sur internet
          </button>
          <button type="button" className="btn ghost sm" onClick={() => cutFileRef.current?.click()} disabled={!!busy}>
            ✂️ Photo sans fond
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
          <input ref={cutFileRef} type="file" accept="image/*" hidden onChange={onCutFile} />
        </div>
      ) : (
        <p className="note" style={{ margin: 0 }}>{MAX_PHOTOS} photos maximum.</p>
      )}
      {searchName.trim().length < 2 && room > 0 && <span className="note">Écrivez d'abord le nom du produit pour chercher des photos.</span>}
      {busy && <span className="note">{busy}</span>}
      {value.length > 0 && <span className="note">✂️ sur une photo : enlever son fond.</span>}
      {cut && (
        <CutoutModal
          src={cut.src}
          useLabel={cut.index === null ? "Ajouter cette photo au produit" : "Remplacer la photo par celle-ci"}
          onUse={applyCut}
          onClose={closeCut}
        />
      )}

      {searching && (
        <div className="gal-search">
          <form
            className="imp-url"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(q);
            }}
          >
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom du produit" />
            <button className="btn sm" disabled={!!busy}>Chercher</button>
            <button type="button" className="btn ghost sm" onClick={() => setSearching(false)}>Fermer</button>
          </form>
          {error && <div className="error">{error}</div>}
          {results && results.length === 0 && <p className="note">Aucune image trouvée. Essayez un autre nom.</p>}
          {results && results.length > 0 && (() => {
            const analysed = results.filter((r) => r.url in bgs).length;
            const plainCount = results.filter((r) => bgs[r.url]?.plain).length;
            const visible = plainOnly ? results.filter((r) => bgs[r.url]?.plain || picked.includes(r.url)) : results;
            return (
            <>
              <label className="pe-check" style={{ margin: 0 }}>
                <input type="checkbox" checked={plainOnly} onChange={(e) => setPlainOnly(e.target.checked)} />
                Fond uni seulement (blanc ou une couleur) — {plainCount} trouvée{plainCount > 1 ? "s" : ""}
                {analysed < results.length && ` · analyse ${analysed}/${results.length}…`}
              </label>
              {plainOnly && analysed === results.length && plainCount === 0 && (
                <p className="note" style={{ margin: 0 }}>Aucune photo à fond uni. Décochez le filtre ou essayez un autre nom.</p>
              )}
              <p className="note" style={{ margin: 0 }}>
                Touchez les photos à ajouter ({picked.length}/{room})
              </p>
              <div className="gal-results">
                {visible.map((r) => {
                  const n = picked.indexOf(r.url);
                  const bg = bgs[r.url];
                  return (
                    <button
                      type="button"
                      key={r.url}
                      className={`gal-res ${n >= 0 ? "on" : ""}`}
                      onClick={() => togglePick(r.url)}
                      title={`${r.title}${r.source ? " — " + r.source : ""}`}
                    >
                      <img src={r.thumb} alt={r.title} loading="lazy" referrerPolicy="no-referrer" />
                      {n >= 0 && <span className="gal-num">{n + 1}</span>}
                      {r.source && <span className="gal-src">{r.source}</span>}
                      {bg?.plain && <span className="gal-bg" style={{ background: bg.color }} title="Fond uni" />}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="btn block" onClick={addPicked} disabled={!picked.length || !!busy}>
                {busy ?? `Ajouter ${picked.length || ""} photo${picked.length > 1 ? "s" : ""}`}
              </button>
            </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
