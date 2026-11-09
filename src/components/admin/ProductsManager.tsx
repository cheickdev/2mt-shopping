"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFcfa, parseFcfa } from "@/lib/money";
import { fileToDataUrl } from "@/components/admin/imageResize";
import VariantsPanel, { VariantRow } from "@/components/admin/VariantsPanel";

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
  featured: boolean;
  active: boolean;
  archived: boolean;
  variants: VariantRow[];
}

const marginPct = (price: number, cost: number) => (price > 0 ? Math.round(((price - cost) / price) * 100) : 0);

function ProductEditor({ p }: { p: ProductRow }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(p.name);
  const [category, setCategory] = useState(p.category);
  const [price, setPrice] = useState(String(p.price));
  const [cost, setCost] = useState(String(p.cost));
  const [stock, setStock] = useState(String(p.stock));
  const [sizes, setSizes] = useState(p.sizes);
  const [description, setDescription] = useState(p.description);
  const [featured, setFeatured] = useState(p.featured);
  const [image, setImage] = useState<string | null>(p.imageData);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showVariants, setShowVariants] = useState(false);

  const hasVariants = p.variants.length > 0;
  const totalStock = hasVariants ? p.variants.reduce((n, v) => n + (v.active ? v.stock : 0), 0) : p.stock;
  const margin = marginPct(parseFcfa(price), parseFcfa(cost));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(await fileToDataUrl(f));
  }

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
        imageData: image,
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
    <div className={`pe-card ${open ? "open" : ""}`}>
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
            <button className={`btn sm ${open ? "ghost" : ""}`} onClick={() => setOpen((o) => !o)}>
              {open ? "Fermer" : "✏️ Modifier"}
            </button>
            <button className="btn ghost sm" onClick={() => setShowVariants((v) => !v)}>
              Variétés ({p.variants.length}) {showVariants ? "▲" : "▼"}
            </button>
          </div>

          {open && (
            <div className="pe-form">
              <div className="pe-photo">
                {image ? <img src={image} alt="" /> : <span className="pe-ph">Pas de photo</span>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
                    📷 {image ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                  {image && (
                    <button type="button" className="btn ghost sm" onClick={() => setImage(null)}>Retirer</button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
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
              <VariantsPanel productId={p.id} variants={p.variants} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CreateForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", category: "", price: "", cost: "", stock: "", sizes: "", description: "", featured: false });
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(await fileToDataUrl(file));
  }

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
          imageData: image,
          featured: f.featured,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setF({ name: "", category: "CHAUSSURES", price: "", cost: "", stock: "", sizes: "", description: "", featured: false });
      setImage(null);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return <button className="btn" style={{ marginBottom: 16 }} onClick={() => setOpen(true)}>+ Ajouter un produit</button>;
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
        <div className="field">
          <label>Photo</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>Choisir une photo</button>
            {image && <img src={image} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>
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
          créez d'abord le produit, puis ouvrez <strong>« Variétés »</strong> sur sa ligne. Le « Stock » ci-dessus
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
  const active = products.filter((p) => !p.archived);
  const archived = products.filter((p) => p.archived);
  const shown = view === "actifs" ? active : archived;

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

      {view === "actifs" && <CreateForm />}

      {view === "archives" && (
        <p className="note">
          Produits archivés : retirés de la boutique et de la liste. Cliquez <strong>« Restaurer »</strong> pour les remettre,
          ou <strong>« Supprimer définitivement »</strong> pour les effacer pour de bon.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="note">
          {view === "actifs" ? "Aucun produit. Cliquez « Ajouter un produit » pour commencer." : "Aucun produit archivé."}
        </p>
      ) : (
        <div className="pe-list">
          {shown.map((p) => <ProductEditor key={p.id} p={p} />)}
        </div>
      )}
    </>
  );
}
