"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatFcfa, parseFcfa } from "@/lib/money";
import VariantsPanel, { VariantRow } from "@/components/admin/VariantsPanel";
import { norm, queryWords } from "@/lib/search";
import ImportProduct from "@/components/admin/ImportProduct";
import CaisseImport from "@/components/admin/CaisseImport";
import TrendsPanel from "@/components/admin/TrendsPanel";
import GalleryEditor from "@/components/admin/GalleryEditor";

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  sizes: string;
  imageData: string | null;
  images: string[]; // toutes les photos (la 1re = principale)
  featured: boolean;
  active: boolean;
  archived: boolean;
  variants: VariantRow[];
}

const marginPct = (price: number, cost: number) => (price > 0 ? Math.round(((price - cost) / price) * 100) : 0);

function ProductEditor({ p }: { p: ProductRow }) {
  const router = useRouter();
  // Un seul panneau ouvert a la fois : edition du produit ou de ses varietes.
  const [panel, setPanel] = useState<"edit" | "variants" | null>(null);
  const open = panel === "edit";
  const showVariants = panel === "variants";
  const [name, setName] = useState(p.name);
  const [category, setCategory] = useState(p.category);
  const [price, setPrice] = useState(String(p.price));
  const [cost, setCost] = useState(String(p.cost));
  const [stock, setStock] = useState(String(p.stock));
  const [sizes, setSizes] = useState(p.sizes);
  const [description, setDescription] = useState(p.description);
  const [featured, setFeatured] = useState(p.featured);
  const [gallery, setGallery] = useState<string[]>(p.images);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const image = gallery[0] ?? null;

  const hasVariants = p.variants.length > 0;
  const totalStock = hasVariants ? p.variants.reduce((n, v) => n + (v.active ? v.stock : 0), 0) : p.stock;
  const margin = marginPct(parseFcfa(price), parseFcfa(cost));

  
  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/produits/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const data = await patch({
        name: name.trim() || p.name,
        category: category.trim() || p.category,
        description: description.trim(),
        price: parseFcfa(price),
        cost: parseFcfa(cost),
        stock: parseInt(stock, 10) || 0,
        sizes: sizes.trim(),
        featured,
        gallery,
      });
      setMsg(data.ok ? { ok: true, text: "Enregistré ✓" } : { ok: false, text: data.error ?? "Erreur" });
      if (data.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: "Erreur réseau" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    await patch({ active: !p.active });
    router.refresh();
  }

  async function setArchived(archived: boolean) {
    await patch({ archived });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Supprimer DÉFINITIVEMENT « ${p.name} » ? Cette action est irréversible. (Astuce : « Archiver » permet de le retrouver plus tard.)`)) return;
    await fetch(`/api/admin/produits/${p.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className={`pe-card ${panel ? "open" : ""}`}>
      {/* Resume (toujours visible) */}
      <div className="pe-head">
        {image ? <img className="pe-thumb" src={image} alt="" /> : <span className="pe-thumb pe-ph">Photo</span>}
        <div className="pe-sum">
          <strong className="pe-name">{p.name}</strong>
          <span className="note">{p.category} · {formatFcfa(p.price)}</span>
          <span className="pe-chips">
            <span className={`pe-chip ${totalStock > 0 ? "" : "bad"}`}>
              {totalStock > 0 ? `${totalStock} en stock` : "Rupture"}
              {hasVariants ? ` · ${p.variants.length} variété${p.variants.length > 1 ? "s" : ""}` : ""}
            </span>
            {!p.active && !p.archived && <span className="pe-chip warn">Masqué</span>}
            {p.featured && <span className="pe-chip gold">⭐ Coup de cœur</span>}
          </span>
        </div>
      </div>

      {p.archived ? (
        <div className="pe-actions">
          <button className="btn sm" onClick={() => setArchived(false)}>↩ Restaurer</button>
          <button className="btn ghost sm" onClick={remove}>Supprimer définitivement</button>
        </div>
      ) : (
        <>
          <div className="pe-actions">
            <button className={`btn sm ${open ? "ghost" : ""}`} onClick={() => setPanel(open ? null : "edit")}>
              {open ? "Fermer" : "✏️ Modifier"}
            </button>
            <button className={`btn sm ${showVariants ? "ghost" : ""}`} onClick={() => setPanel(showVariants ? null : "variants")}>
              {showVariants ? "Fermer" : `🎨 Variétés (${p.variants.length})`}
            </button>
          </div>

          {open && (
            <div className="pe-form">
              <div className="field pe-full">
                <label>Photos ({gallery.length})</label>
                <GalleryEditor value={gallery} onChange={setGallery} searchName={name} />
              </div>

              <div className="field pe-full">
                <label>Nom</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field pe-full">
                <label>Catégorie</label>
                <input className="input" list="cat-suggestions" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="field">
                <label>Prix de vente (FCFA)</label>
                <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="field">
                <label>Coût d'achat (FCFA)</label>
                <input className="input" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <div className="field">
                <label>Stock</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  disabled={hasVariants}
                />
                {hasVariants && <span className="note">Géré par variété ({totalStock} au total).</span>}
              </div>
              <div className="field">
                <label>Marge</label>
                <div className="pe-margin">
                  {margin}% · {formatFcfa(Math.max(0, parseFcfa(price) - parseFcfa(cost)))}
                </div>
              </div>
              {!hasVariants && (
                <div className="field pe-full">
                  <label>Options simples (séparées par des virgules)</label>
                  <input className="input" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="Ex. 38,39,40 ou Rouge,Noir" />
                </div>
              )}
              <div className="field pe-full">
                <label>Description</label>
                <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <label className="pe-check pe-full">
                <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> ⭐ Coup de cœur sur l'accueil
              </label>

              <div className="pe-full pe-save">
                <button className="btn block" onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
                {msg && <div className={msg.ok ? "success" : "error"}>{msg.text}</div>}
              </div>

              <div className="pe-full pe-more">
                <button className="btn ghost sm" onClick={toggleActive}>{p.active ? "🙈 Masquer de la boutique" : "👁 Afficher dans la boutique"}</button>
                <button className="btn ghost sm" onClick={() => setArchived(true)}>🗑 Archiver</button>
              </div>
            </div>
          )}

          {showVariants && (
            <div className="pe-variants">
              <h4 className="pe-title">Variétés de « {p.name} »</h4>
              <VariantsPanel productId={p.id} variants={p.variants} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CreateForm({ onImport, onCaisse, onTrends }: { onImport: () => void; onCaisse: () => void; onTrends: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", category: "", price: "", cost: "", stock: "", sizes: "", description: "", featured: false });
  const [gallery, setGallery] = useState<string[]>([]);
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
          name: f.name.trim(),
          category: f.category,
          description: f.description.trim(),
          price: parseFcfa(f.price),
          cost: parseFcfa(f.cost),
          stock: parseInt(f.stock, 10) || 0,
          sizes: f.sizes.trim(),
          gallery,
          featured: f.featured,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setF({ name: "", category: "CHAUSSURES", price: "", cost: "", stock: "", sizes: "", description: "", featured: false });
      setGallery([]);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="btn" onClick={() => setOpen(true)}>+ Ajouter un produit</button>
        <button className="btn ghost" onClick={onTrends}>🔥 Tendances</button>
        <button className="btn ghost" onClick={onCaisse}>🏪 Importer depuis la caisse</button>
        <button className="btn ghost" onClick={onImport}>⬇️ Importer depuis un lien</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <h3 style={{ marginTop: 0 }}>Nouveau produit</h3>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Nom</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. Escarpins vernis rouge" />
        </div>
        <div className="field">
          <label>Catégorie</label>
          <input
            className="input"
            list="cat-suggestions"
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}
            placeholder="Ex. Chaussures, Vêtements, Parfums…"
          />
          <span className="note">Choisissez une catégorie existante ou tapez-en une nouvelle.</span>
        </div>
        <div className="field">
          <label>Prix de vente (FCFA)</label>
          <input className="input" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="12000" />
        </div>
        <div className="field">
          <label>Coût d'achat (FCFA)</label>
          <input className="input" inputMode="numeric" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} placeholder="7000" />
        </div>
        <div className="field">
          <label>Stock</label>
          <input className="input" inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} placeholder="10" />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Photos ({gallery.length})</label>
          <GalleryEditor value={gallery} onChange={setGallery} searchName={f.name} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Description</label>
          <textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Détails, matière, conseils…" />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", gridColumn: "1 / -1" }}>
          <input type="checkbox" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} /> Mettre en « Coup de cœur » sur l'accueil
        </label>
        <p className="note" style={{ gridColumn: "1 / -1", margin: 0 }}>
          💡 Pour des variétés (pointures, contenances, couleurs) avec <strong>chacune son stock et sa photo</strong>,
          créez d'abord le produit, puis touchez <strong>« Variétés »</strong> sur sa carte. Le « Stock » ci-dessus
          ne sert que si le produit n'a aucune variété.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn" onClick={create} disabled={saving || !f.name || !f.category.trim()}>{saving ? "…" : "Créer le produit"}</button>
        <button className="btn ghost" onClick={() => setOpen(false)}>Annuler</button>
      </div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}

export default function ProductsManager({ products, categories }: { products: ProductRow[]; categories: string[] }) {
  const [view, setView] = useState<"actifs" | "archives">("actifs");
  const [q, setQ] = useState("");
  const [importing, setImporting] = useState<null | "lien" | "caisse" | "tendances">(null);
  const active = products.filter((p) => !p.archived);
  const archived = products.filter((p) => p.archived);
  // Recherche dynamique : filtre pendant la saisie (nom, categorie, description, varietes).
  const words = queryWords(q);
  const shown = (view === "actifs" ? active : archived).filter((p) => {
    if (words.length === 0) return true;
    const hay = norm(`${p.name} ${p.category} ${p.description} ${p.sizes} ${p.variants.map((v) => v.label).join(" ")}`);
    return words.every((w) => hay.includes(w));
  });

  return (
    <>
      <datalist id="cat-suggestions">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className={`btn ${view === "actifs" ? "" : "ghost"} sm`} onClick={() => setView("actifs")}>
          Produits ({active.length})
        </button>
        <button className={`btn ${view === "archives" ? "" : "ghost"} sm`} onClick={() => setView("archives")}>
          Archives ({archived.length})
        </button>
      </div>

      {view === "actifs" &&
        (importing === "lien" ? (
          <ImportProduct onClose={() => setImporting(null)} />
        ) : importing === "caisse" ? (
          <CaisseImport onClose={() => setImporting(null)} />
        ) : importing === "tendances" ? (
          <TrendsPanel categories={categories} onClose={() => setImporting(null)} />
        ) : (
          <CreateForm onImport={() => setImporting("lien")} onCaisse={() => setImporting("caisse")} onTrends={() => setImporting("tendances")} />
        ))}

      <div className="pe-search">
        <input
          className="input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Rechercher un produit (nom, catégorie, variété…)"
          aria-label="Rechercher un produit"
        />
        {q && <span className="note">{shown.length} résultat{shown.length > 1 ? "s" : ""}</span>}
      </div>

      {view === "archives" && (
        <p className="note">
          Produits archivés : retirés de la boutique et de la liste. Cliquez <strong>« Restaurer »</strong> pour les remettre,
          ou <strong>« Supprimer définitivement »</strong> pour les effacer pour de bon.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="note">
          {q
            ? `Aucun produit ne correspond à « ${q} ».`
            : view === "actifs"
              ? "Aucun produit. Cliquez « Ajouter un produit » pour commencer."
              : "Aucun produit archivé."}
        </p>
      ) : (
        <div className="pe-list">
          {shown.map((p) => <ProductEditor key={p.id} p={p} />)}
        </div>
      )}
    </>
  );
}
