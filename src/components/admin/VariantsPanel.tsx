"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fileToDataUrl } from "@/components/admin/imageResize";

export interface VariantRow {
  id: string;
  label: string;
  stock: number;
  imageData: string | null;
  active: boolean;
}

// Formulaire d'une variete existante (meme style que l'edition du produit).
function VariantForm({ v }: { v: VariantRow }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(v.label);
  const [stock, setStock] = useState(String(v.stock));
  const [image, setImage] = useState<string | null>(v.imageData);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(await fileToDataUrl(f));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/variantes/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || v.label, stock: parseInt(stock, 10) || 0, imageData: image }),
      });
      const data = await res.json();
      setMsg(data.ok ? { ok: true, text: "Enregistré ✓" } : { ok: false, text: data.error ?? "Erreur" });
      if (data.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: "Erreur réseau" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Supprimer la variété « ${v.label} » ?`)) return;
    await fetch(`/api/admin/variantes/${v.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="ve-item">
      <div className="pe-photo">
        {image ? <img src={image} alt="" /> : <span className="pe-ph">Pas de photo</span>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
            📷 {image ? "Changer" : "Ajouter une photo"}
          </button>
          {image && <button type="button" className="btn ghost sm" onClick={() => setImage(null)}>Retirer</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
      <div className="ve-fields">
        <div className="field">
          <label>Nom de la variété</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="field">
          <label>Stock</label>
          <input className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
      </div>
      <div className="pe-actions">
        <button className="btn sm" onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
        <button className="btn ghost sm" onClick={remove}>🗑 Supprimer</button>
      </div>
      {msg && <div className={msg.ok ? "success" : "error"}>{msg.text}</div>}
    </div>
  );
}

// Editeur des varietes d'un produit : chaque variete a son nom, son stock et sa photo.
export default function VariantsPanel({ productId, variants }: { productId: string; variants: VariantRow[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [stock, setStock] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(await fileToDataUrl(f));
  }

  async function add() {
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/produits/${productId}/variantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), stock: parseInt(stock, 10) || 0, imageData: image }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setLabel("");
      setStock("");
      setImage(null);
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ve">
      <p className="note" style={{ margin: 0 }}>
        Chaque variété (pointure, contenance, couleur…) a son nom, son stock et sa photo. Le client choisira parmi elles.
      </p>

      {variants.map((v) => <VariantForm key={v.id} v={v} />)}

      <div className="ve-item ve-new">
        <strong>Nouvelle variété</strong>
        <div className="pe-photo">
          {image ? <img src={image} alt="" /> : <span className="pe-ph">Pas de photo</span>}
          <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
            📷 {image ? "Changer" : "Ajouter une photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        </div>
        <div className="ve-fields">
          <div className="field">
            <label>Nom de la variété</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Sauvage 100ml, Pointure 39" />
          </div>
          <div className="field">
            <label>Stock</label>
            <input className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
          </div>
        </div>
        <button className="btn block" onClick={add} disabled={saving || !label.trim()}>{saving ? "…" : "+ Ajouter la variété"}</button>
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
