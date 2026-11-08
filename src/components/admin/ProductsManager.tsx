"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFcfa, parseFcfa } from "@/lib/money";

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
}

// Redimensionne une photo cote navigateur -> Data URL JPEG legere.
async function fileToDataUrl(file: File, maxDim = 900, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  let { width, height } = img;
  if (width > height && width > maxDim) {
    height = Math.round((height * maxDim) / width);
    width = maxDim;
  } else if (height > maxDim) {
    width = Math.round((width * maxDim) / height);
    height = maxDim;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

const marginPct = (price: number, cost: number) => (price > 0 ? Math.round(((price - cost) / price) * 100) : 0);

function Row({ p }: { p: ProductRow }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(p.category);
  const [price, setPrice] = useState(String(p.price));
  const [cost, setCost] = useState(String(p.cost));
  const [stock, setStock] = useState(String(p.stock));
  const [featured, setFeatured] = useState(p.featured);
  const [image, setImage] = useState<string | null>(p.imageData);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(await fileToDataUrl(f));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/produits/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.trim() || p.category,
          price: parseFcfa(price),
          cost: parseFcfa(cost),
          stock: parseInt(stock, 10) || 0,
          featured,
          imageData: image,
        }),
      });
      const data = await res.json();
      setMsg(data.ok ? "Enregistré ✓" : data.error ?? "Erreur");
      if (data.ok) router.refresh();
    } catch {
      setMsg("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    await fetch(`/api/admin/produits/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Retirer ce produit de la boutique ?")) return;
    await fetch(`/api/admin/produits/${p.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <tr>
      <td>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={() => fileRef.current?.click()} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}>
            {image ? (
              <img src={image} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 8 }} />
            ) : (
              <span style={{ width: 46, height: 46, borderRadius: 8, background: "var(--surface-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--muted)" }}>Photo</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          <div style={{ minWidth: 0 }}>
            <strong>{p.name}</strong>
            <input
              className="input sm"
              list="cat-suggestions"
              style={{ marginTop: 4, width: 140 }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Catégorie"
            />
          </div>
        </div>
      </td>
      <td><input className="input sm" style={{ width: 90 }} value={price} onChange={(e) => setPrice(e.target.value)} /></td>
      <td><input className="input sm" style={{ width: 80 }} value={cost} onChange={(e) => setCost(e.target.value)} /></td>
      <td style={{ fontWeight: 700, color: "var(--gold)" }}>{marginPct(parseFcfa(price), parseFcfa(cost))}%</td>
      <td><input className="input sm" style={{ width: 60 }} value={stock} onChange={(e) => setStock(e.target.value)} /></td>
      <td>
        <label style={{ display: "inline-flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> ⭐
        </label>
      </td>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button className="btn sm" onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn ghost sm" onClick={toggleActive}>{p.active ? "Masquer" : "Afficher"}</button>
            <button className="btn ghost sm" onClick={remove}>🗑</button>
          </div>
          {msg && <div className="note" style={{ fontSize: 12 }}>{msg}</div>}
        </div>
      </td>
    </tr>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
          <label>Tailles / variantes (séparées par virgule)</label>
          <input className="input" value={f.sizes} onChange={(e) => setF({ ...f, sizes: e.target.value })} placeholder="38,39,40 ou Rouge,Noir" />
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
  return (
    <>
      <datalist id="cat-suggestions">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <CreateForm />
      {products.length === 0 ? (
        <p className="note">Aucun produit. Cliquez « Ajouter un produit » pour commencer.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Produit</th><th>Prix</th><th>Coût</th><th>Marge</th><th>Stock</th><th>⭐</th><th></th></tr>
            </thead>
            <tbody>
              {products.map((p) => <Row key={p.id} p={p} />)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
