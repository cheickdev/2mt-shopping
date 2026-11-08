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

function VariantLine({ v }: { v: VariantRow }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stock, setStock] = useState(String(v.stock));
  const [label, setLabel] = useState(v.label);
  const [image, setImage] = useState<string | null>(v.imageData);
  const [saving, setSaving] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const data = await fileToDataUrl(f);
    setImage(data);
    await save({ imageData: data });
  }

  async function save(extra?: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch(`/api/admin/variantes/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || v.label, stock: parseInt(stock, 10) || 0, ...extra }),
      });
      router.refresh();
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
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
      <button type="button" onClick={() => fileRef.current?.click()} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}>
        {image ? (
          <img src={image} alt="" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 8 }} />
        ) : (
          <span style={{ width: 42, height: 42, borderRadius: 8, background: "var(--surface-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "var(--muted)" }}>Photo</span>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <input className="input sm" style={{ flex: 1, minWidth: 90 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom de la variété" />
      <input className="input sm" style={{ width: 70 }} value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" title="Stock" />
      <button className="btn sm" onClick={() => save()} disabled={saving}>{saving ? "…" : "OK"}</button>
      <button className="btn ghost sm" onClick={remove} title="Supprimer">🗑</button>
    </div>
  );
}

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
    <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: 12, margin: "2px 0 8px" }}>
      <div className="note" style={{ marginBottom: 6 }}>
        <strong>Variétés</strong> — chacune a son stock et sa photo. Le client choisira parmi elles.
      </div>

      {variants.length === 0 && <div className="note" style={{ marginBottom: 6 }}>Aucune variété. Ajoutez-en une ci-dessous (ex. une pointure, une contenance).</div>}
      {variants.map((v) => <VariantLine key={v.id} v={v} />)}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
          {image ? "Photo ✓" : "Photo"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        <input className="input sm" style={{ flex: 1, minWidth: 120 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nouvelle variété (ex. Sauvage 100ml)" />
        <input className="input sm" style={{ width: 80 }} value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" placeholder="Stock" />
        <button className="btn sm" onClick={add} disabled={saving || !label.trim()}>{saving ? "…" : "+ Ajouter"}</button>
      </div>
      {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
