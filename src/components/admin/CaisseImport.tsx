"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseFcfa, formatFcfa } from "@/lib/money";
import { parseCaisseFile, type CaisseRow } from "@/lib/caisse-file";
import GalleryEditor from "@/components/admin/GalleryEditor";

interface Result extends CaisseRow {
  onSite: string | null; // nom du produit deja cree sur le site, sinon null
}

// Importer des produits de la caisse « Alimentation Tounkara » :
// 1) envoyer le fichier d'export de la caisse (une fois, puis de temps en temps) ;
// 2) chercher un produit ; 3) le verifier/corriger, ajouter les photos, creer.
export default function CaisseImport({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [hideDone, setHideDone] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editing, setEditing] = useState<Result | null>(null);
  const [reload, setReload] = useState(0);

  // Recherche (petite pause pendant la frappe pour ne pas surcharger le serveur).
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/caisse?q=${encodeURIComponent(q)}`);
        const d = await res.json();
        if (!alive) return;
        if (!d.ok) setError(d.error ?? "Recherche impossible.");
        else {
          setCount(d.count);
          setUpdatedAt(d.updatedAt);
          setResults(d.results);
        }
      } catch {
        if (alive) setError("Impossible de contacter le serveur.");
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, reload]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);
    setInfo(null);
    setUploading("Lecture du fichier…");
    try {
      const rows = parseCaisseFile(await f.text());
      setUploading(`Envoi de ${rows.length} produits…`);
      const res = await fetch("/api/admin/caisse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: rows }),
      });
      const d = await res.json().catch(() => ({ ok: false, error: "Fichier trop gros pour être envoyé." }));
      if (!d.ok) setError(d.error ?? "Envoi impossible.");
      else {
        setInfo(`✅ ${d.count} produits de la caisse enregistrés. Cherchez-les ci-dessous.`);
        setReload((r) => r + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fichier illisible.");
    } finally {
      setUploading(null);
    }
  }

  const shown = hideDone ? results.filter((r) => !r.onSite) : results;
  const hidden = results.length - shown.length;
  const date = updatedAt ? new Date(updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

  if (editing) {
    return (
      <CaisseProductForm
        row={editing}
        onCancel={() => setEditing(null)}
        onCreated={(name) => {
          setEditing(null);
          setInfo(`✅ « ${name} » est maintenant sur le site.`);
          setReload((r) => r + 1);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="card imp" style={{ padding: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>🏪 Importer depuis la caisse</h3>
        <button className="btn ghost sm" onClick={onClose}>Fermer</button>
      </div>

      {count === 0 ? (
        <div className="caisse-help">
          <p style={{ margin: "8px 0" }}>
            Pour commencer, envoyez la liste des produits de votre caisse <strong>Alimentation Tounkara</strong> :
          </p>
          <ol>
            <li>
              <strong>Une seule fois</strong>, sur l'ordinateur du magasin :{" "}
              <a href="/caisse/export_boutique.php" download="export_boutique.php">téléchargez la page d'export</a> et
              placez-la dans le dossier de la caisse, à côté de <code>products.php</code> (souvent{" "}
              <code>C:\xampp\htdocs\alimentation-tounkara</code>).
            </li>
            <li>
              Connectez-vous à la caisse, puis remplacez <code>products.php</code> par <code>export_boutique.php</code> dans
              l'adresse : un fichier <code>produits-caisse-….json</code> se télécharge.
            </li>
            <li>Ici, touchez « Envoyer le fichier de la caisse » et choisissez ce fichier.</li>
          </ol>
          <p className="note" style={{ margin: 0 }}>Un export de la table « products » depuis phpMyAdmin (CSV ou JSON) marche aussi.</p>
        </div>
      ) : (
        count !== null && (
          <p className="note" style={{ margin: "6px 0 0" }}>
            {count} produits de la caisse{date ? `, liste du ${date}` : ""}. Renvoyez le fichier quand vous ajoutez des produits en caisse.
          </p>
        )
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
        <button className={`btn ${count === 0 ? "" : "ghost"} sm`} onClick={() => fileRef.current?.click()} disabled={!!uploading}>
          {uploading ?? (count ? "📤 Renvoyer le fichier de la caisse" : "📤 Envoyer le fichier de la caisse")}
        </button>
        <input ref={fileRef} type="file" accept=".json,.csv,.txt,application/json,text/csv" hidden onChange={onFile} />
      </div>
      {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}
      {info && <p className="note" style={{ margin: "0 0 10px", color: "var(--fg)" }}>{info}</p>}

      {!!count && (
        <>
          <input
            className="input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Chercher un produit de la caisse (nom, catégorie, code-barres)"
            aria-label="Chercher un produit de la caisse"
          />
          <label className="pe-check" style={{ margin: "8px 0" }}>
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Masquer les produits déjà sur le site
            {hideDone && hidden > 0 && ` (${hidden} masqué${hidden > 1 ? "s" : ""})`}
          </label>
          {loading && <p className="note" style={{ margin: 0 }}>Recherche…</p>}
          {!loading && shown.length === 0 && <p className="note">Aucun produit ne correspond{q ? ` à « ${q} »` : ""}.</p>}
          <div className="caisse-list">
            {shown.map((r) => (
              <div key={r.ref} className={`caisse-item ${r.onSite ? "done" : ""}`}>
                <div className="caisse-info">
                  <strong>{r.name}</strong>
                  <span className="note">
                    {[r.category, r.price ? formatFcfa(r.price) : "prix ?", `stock ${r.stock}`, r.barcode && `code ${r.barcode}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {r.onSite && <span className="pe-chip">✓ Déjà sur le site : {r.onSite}</span>}
                </div>
                <button className={`btn ${r.onSite ? "ghost" : ""} sm`} onClick={() => setEditing(r)}>
                  {r.onSite ? "Réimporter" : "Importer"}
                </button>
              </div>
            ))}
          </div>
          {results.length >= 40 && <p className="note">Seuls les 40 premiers résultats sont affichés : précisez la recherche.</p>}
        </>
      )}
    </div>
  );
}

// Fiche pre-remplie avec les infos de la caisse, a verifier avant creation.
function CaisseProductForm({ row, onCancel, onCreated }: { row: Result; onCancel: () => void; onCreated: (name: string) => void }) {
  const [name, setName] = useState(row.name);
  const [category, setCategory] = useState(row.category);
  const [price, setPrice] = useState(row.price ? String(row.price) : "");
  const [cost, setCost] = useState(row.cost ? String(row.cost) : "");
  const [stock, setStock] = useState(String(Math.max(0, row.stock)));
  const [description, setDescription] = useState(row.description);
  const [gallery, setGallery] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/produits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          description: description.trim(),
          price: parseFcfa(price),
          cost: parseFcfa(cost),
          stock: parseInt(stock, 10) || 0,
          sizes: "",
          gallery,
          featured: false,
          active,
          caisseRef: row.ref,
        }),
      });
      const d = await res.json();
      if (!d.ok) setError(d.error ?? "Erreur lors de la création.");
      else onCreated(name.trim());
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  const ready = name.trim() && category.trim() && parseFcfa(price) > 0;

  return (
    <div className="card imp" style={{ padding: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>🏪 Importer « {row.name} »</h3>
        <button className="btn ghost sm" onClick={onCancel}>← Retour</button>
      </div>
      <p className="note" style={{ margin: "6px 0 10px" }}>
        Infos reprises de la caisse{row.barcode ? ` (code-barres ${row.barcode})` : ""}. Vérifiez-les, ajoutez des photos, puis créez le produit.
        {row.onSite && <strong> Attention : ce produit est déjà sur le site (« {row.onSite} »).</strong>}
      </p>
      <div className="pe-form" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="field pe-full">
          <label>Nom</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field pe-full">
          <label>Catégorie sur le site</label>
          <input className="input" list="cat-suggestions" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex. Cosmétiques" />
          <span className="note">Reprise de la caisse : choisissez une catégorie du site si elle est différente.</span>
        </div>
        <div className="field">
          <label>Prix de vente (FCFA)</label>
          <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex. 3500" />
        </div>
        <div className="field">
          <label>Coût d'achat (FCFA)</label>
          <input className="input" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div className="field">
          <label>Stock{row.unit ? ` (${row.unit})` : ""}</label>
          <input className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <div className="field pe-full">
          <label>Photos ({gallery.length})</label>
          <GalleryEditor value={gallery} onChange={setGallery} searchName={name} />
        </div>
        <div className="field pe-full">
          <label>Description</label>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Détails, contenance, conseils…" />
        </div>
        <label className="pe-check pe-full" style={{ margin: 0 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Visible tout de suite dans la boutique
        </label>
        {gallery.length === 0 && (
          <p className="note pe-full" style={{ margin: 0 }}>
            Pas encore de photo ? Décochez « Visible » : le produit restera caché jusqu'à ce que vous ajoutiez sa photo.
          </p>
        )}
      </div>
      {error && <div className="error" style={{ margin: "10px 0" }}>{error}</div>}
      <button className="btn block" onClick={create} disabled={saving || !ready} style={{ marginTop: 12 }}>
        {saving ? "Création…" : "Créer le produit sur le site"}
      </button>
      {!ready && <p className="note" style={{ margin: "6px 0 0", textAlign: "center" }}>Indiquez le nom, la catégorie et le prix.</p>}
    </div>
  );
}
