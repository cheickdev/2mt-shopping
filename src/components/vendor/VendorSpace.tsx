"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatFcfa, parseFcfa } from "@/lib/money";
import GalleryEditor from "@/components/admin/GalleryEditor";

export interface VendorProductRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  sizes: string;
  gallery: string[];
  active: boolean;
  status: "APPROVED" | "PENDING" | "REJECTED";
  rejectReason: string;
}

const STATUS: Record<VendorProductRow["status"], { label: string; cls: string }> = {
  APPROVED: { label: "En ligne", cls: "ok" },
  PENDING: { label: "En attente de validation", cls: "wait" },
  REJECTED: { label: "Refusé", cls: "no" },
};

export default function VendorSpace({
  vendor,
  products,
  categories,
}: {
  vendor: { name: string; slug: string; maxProducts: number; freeUntil: string | null };
  products: VendorProductRow[];
  categories: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<VendorProductRow | "new" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function logout() {
    await fetch("/api/vendeur/logout", { method: "POST" });
    router.push("/vendeur/connexion");
    router.refresh();
  }
  async function toggle(p: VendorProductRow) {
    await fetch(`/api/vendeur/produits/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    router.refresh();
  }
  async function remove(p: VendorProductRow) {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    await fetch(`/api/vendeur/produits/${p.id}`, { method: "DELETE" });
    router.refresh();
  }

  const full = products.length >= vendor.maxProducts;
  const freeUntil = vendor.freeUntil ? new Date(vendor.freeUntil) : null;

  return (
    <div className="vendor-space">
      <div className="vs-head">
        <div>
          <h1 style={{ margin: 0 }}>{vendor.name}</h1>
          <div className="note">Mon espace vendeur</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn ghost sm" href={`/vendeur/${vendor.slug}`} target="_blank" rel="noopener noreferrer">Voir ma boutique</a>
          <button className="btn ghost sm" onClick={logout}>Se déconnecter</button>
        </div>
      </div>

      <div className="vs-info">
        <div>📦 <b>{products.length}</b> / {vendor.maxProducts} produits</div>
        <div>{freeUntil ? <>🎁 Gratuit jusqu'au <b>{freeUntil.toLocaleDateString("fr-FR")}</b></> : <>🎁 Gratuit</>}</div>
        <div>✅ Chaque nouveau produit est vérifié par 2MT avant d'apparaître sur le site.</div>
        <div>📲 Les clients vous contactent directement sur votre WhatsApp.</div>
      </div>

      {msg && <div className="vs-msg">{msg}</div>}

      {editing ? (
        <VendorProductForm
          initial={editing === "new" ? null : editing}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSaved={(pending) => {
            setEditing(null);
            setMsg(pending ? "Enregistré ✓ Votre produit sera visible dès que 2MT l'aura validé." : "Enregistré ✓");
            router.refresh();
          }}
        />
      ) : (
        <button className="btn" disabled={full} onClick={() => { setMsg(null); setEditing("new"); }}>
          {full ? "Limite de produits atteinte" : "+ Ajouter un produit"}
        </button>
      )}

      <div className="vs-list">
        {products.length === 0 && <p className="note">Vous n'avez pas encore de produit. Cliquez sur « Ajouter un produit ».</p>}
        {products.map((p) => (
          <div key={p.id} className={`vs-item ${p.active ? "" : "off"}`}>
            <div className="vs-thumb">{p.gallery[0] ? <img src={p.gallery[0]} alt="" /> : null}</div>
            <div className="vs-body">
              <div className="vs-name">{p.name}</div>
              <div className="note">{p.category} · {formatFcfa(p.price)} · stock {p.stock}</div>
              <span className={`vs-status ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
              {!p.active && <span className="vs-status off">Retiré de la vente</span>}
              {p.status === "REJECTED" && p.rejectReason && <div className="error" style={{ marginTop: 6 }}>Motif : {p.rejectReason}</div>}
            </div>
            <div className="vs-actions">
              {p.status === "APPROVED" && p.active && <a className="btn ghost sm" href={`/produit/${p.slug}`} target="_blank" rel="noopener noreferrer">Voir</a>}
              <button className="btn ghost sm" onClick={() => { setMsg(null); setEditing(p); }}>Modifier</button>
              <button className="btn ghost sm" onClick={() => toggle(p)}>{p.active ? "Retirer" : "Remettre en vente"}</button>
              <button className="btn ghost sm danger" onClick={() => remove(p)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VendorProductForm({
  initial,
  categories,
  onCancel,
  onSaved,
}: {
  initial: VendorProductRow | null;
  categories: string[];
  onCancel: () => void;
  onSaved: (pending: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [stock, setStock] = useState(initial ? String(initial.stock) : "1");
  const [sizes, setSizes] = useState(initial?.sizes ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [gallery, setGallery] = useState<string[]>(initial?.gallery ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(initial ? `/api/vendeur/produits/${initial.id}` : "/api/vendeur/produits", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          price: parseFcfa(price),
          stock: parseInt(stock, 10) || 0,
          sizes: sizes.trim(),
          description: description.trim(),
          gallery,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Enregistrement impossible.");
        return;
      }
      onSaved(initial ? !!data.pending : true);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="summary vs-form" onSubmit={save}>
      <h2 style={{ margin: 0 }}>{initial ? "Modifier le produit" : "Nouveau produit"}</h2>
      <div className="field">
        <label>Photos (la 1re est la principale)</label>
        <GalleryEditor value={gallery} onChange={setGallery} searchName={name} />
      </div>
      <div className="field">
        <label htmlFor="vp-name">Nom du produit</label>
        <input id="vp-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Sandales à talons dorées" required />
      </div>
      <div className="vs-row">
        <div className="field">
          <label htmlFor="vp-cat">Catégorie</label>
          <select id="vp-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">— Choisir —</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            {category && !categories.includes(category) && <option value={category}>{category}</option>}
          </select>
        </div>
        <div className="field">
          <label htmlFor="vp-price">Prix (FCFA)</label>
          <input id="vp-price" className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex. 7500" required />
        </div>
        <div className="field">
          <label htmlFor="vp-stock">Quantité disponible</label>
          <input id="vp-stock" className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="vp-sizes">Tailles / pointures / couleurs (facultatif, séparées par des virgules)</label>
        <input id="vp-sizes" className="input" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="Ex. 37, 38, 39, 40" />
      </div>
      <div className="field">
        <label htmlFor="vp-desc">Description</label>
        <textarea id="vp-desc" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {initial && initial.status === "APPROVED" && (
        <p className="note" style={{ margin: 0 }}>Changer seulement le prix ou la quantité ne demande pas de nouvelle validation.</p>
      )}
      {error && <div className="error">{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" disabled={saving}>{saving ? "Enregistrement…" : initial ? "Enregistrer" : "Envoyer pour validation"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
