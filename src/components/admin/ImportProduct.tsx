"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseFcfa } from "@/lib/money";
import { remoteToDataUrl } from "@/components/admin/imageResize";
import { MAX_PHOTOS } from "@/components/admin/GalleryEditor";
import type { ImportedProduct } from "@/lib/product-import";

interface VariantDraft {
  include: boolean;
  label: string;
  stock: string;
  image: string | null; // URL d'origine
}

const proxied = (u: string) => `/api/admin/import/image?url=${encodeURIComponent(u)}`;

// Importer un produit depuis le lien d'un autre site (Amazon, Shopify…).
export default function ImportProduct({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ImportedProduct | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  // Photos choisies, dans l'ordre (la 1re = principale).
  const [photos, setPhotos] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [creating, setCreating] = useState<string | null>(null);

  async function fetchProduct(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const d = await res.json();
      if (!d.ok) {
        setError(d.error ?? "Lecture impossible.");
        return;
      }
      const p = d.product as ImportedProduct;
      setData(p);
      setName(p.name);
      setDescription(p.description);
      setPhotos(p.images.slice(0, 1));
      setVariants(p.variants.map((v) => ({ include: true, label: v.label, stock: "", image: v.image })));
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  const setV = (i: number, patch: Partial<VariantDraft>) =>
    setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const chosen = variants.filter((v) => v.include && v.label.trim());

  async function create() {
    if (!data) return;
    setError(null);
    try {
      const gallery: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setCreating(`Photo ${i + 1}/${photos.length}…`);
        try {
          gallery.push(await remoteToDataUrl(photos[i]));
        } catch {
          /* photo inaccessible : on continue sans elle */
        }
      }
      setCreating("Création du produit…");
      const res = await fetch("/api/admin/produits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          description: description.trim(),
          price: parseFcfa(price),
          cost: parseFcfa(cost),
          stock: chosen.length ? 0 : parseInt(stock, 10) || 0,
          sizes: "",
          gallery,
          featured: false,
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        setError(d.error ?? "Erreur lors de la création.");
        return;
      }
      const productId: string | undefined = d.id;
      if (productId && chosen.length) {
        for (let i = 0; i < chosen.length; i++) {
          const v = chosen[i];
          setCreating(`Variété ${i + 1}/${chosen.length}…`);
          let vImg: string | null = null;
          if (v.image) {
            try {
              vImg = await remoteToDataUrl(v.image);
            } catch {
              vImg = null;
            }
          }
          await fetch(`/api/admin/produits/${productId}/variantes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: v.label.trim().slice(0, 60), stock: parseInt(v.stock, 10) || 0, imageData: vImg }),
          });
        }
      }
      router.refresh();
      onClose();
    } catch {
      setError("Erreur réseau pendant la création.");
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="card imp" style={{ padding: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Importer depuis un lien</h3>
        <button className="btn ghost sm" onClick={onClose}>Fermer</button>
      </div>
      <p className="note" style={{ margin: "6px 0 10px" }}>
        Collez le lien d'un produit (Amazon, boutique en ligne…). Le nom, la description, les photos et les variétés
        sont récupérés ; vérifiez-les et indiquez <strong>votre prix en FCFA</strong> avant de créer le produit.
      </p>

      <form onSubmit={fetchProduct} className="imp-url">
        <input
          className="input"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.amazon.fr/…"
          required
        />
        <button className="btn" disabled={loading || !url.trim()}>{loading ? "Lecture…" : "Récupérer"}</button>
      </form>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}

      {data && (
        <div className="imp-preview">
          <p className="note" style={{ margin: 0 }}>
            Source : <a href={data.url} target="_blank" rel="noopener noreferrer">{data.source}</a>
            {data.price != null && <> · Prix sur ce site : {data.price} {data.currency ?? ""}</>}
          </p>

          {data.images.length > 0 && (
            <div className="field">
              <label>Photos à garder ({photos.length}/{MAX_PHOTOS}) — la n°1 sera la principale</label>
              <div className="imp-images">
                {data.images.map((src) => {
                  const n = photos.indexOf(src);
                  return (
                    <button
                      type="button"
                      key={src}
                      className={`imp-img gal-res ${n >= 0 ? "on" : ""}`}
                      onClick={() =>
                        setPhotos((ph) => (n >= 0 ? ph.filter((x) => x !== src) : ph.length < MAX_PHOTOS ? [...ph, src] : ph))
                      }
                      aria-pressed={n >= 0}
                    >
                      <img src={proxied(src)} alt="" loading="lazy" />
                      {n >= 0 && <span className="gal-num">{n + 1}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pe-form" style={{ borderTop: "none", paddingTop: 0 }}>
            <div className="field pe-full">
              <label>Nom</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field pe-full">
              <label>Catégorie</label>
              <input className="input" list="cat-suggestions" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex. Cosmétiques" />
            </div>
            <div className="field">
              <label>Votre prix de vente (FCFA)</label>
              <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex. 3500" />
            </div>
            <div className="field">
              <label>Coût d'achat (FCFA)</label>
              <input className="input" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Ex. 2000" />
            </div>
            {chosen.length === 0 && (
              <div className="field">
                <label>Stock</label>
                <input className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
              </div>
            )}
            <div className="field pe-full">
              <label>Description</label>
              <textarea className="input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {variants.length > 0 && (
            <div className="field">
              <label>Variétés trouvées ({chosen.length} retenue{chosen.length > 1 ? "s" : ""})</label>
              <div className="ve">
                {variants.map((v, i) => (
                  <div key={i} className={`ve-item ${v.include ? "" : "imp-off"}`}>
                    <label className="pe-check" style={{ margin: 0 }}>
                      <input type="checkbox" checked={v.include} onChange={(e) => setV(i, { include: e.target.checked })} /> Garder cette variété
                    </label>
                    <div className="ve-fields">
                      <div className="field">
                        <label>Nom</label>
                        <input className="input" value={v.label} onChange={(e) => setV(i, { label: e.target.value })} disabled={!v.include} />
                      </div>
                      <div className="field">
                        <label>Stock</label>
                        <input className="input" inputMode="numeric" value={v.stock} onChange={(e) => setV(i, { stock: e.target.value })} disabled={!v.include} placeholder="0" />
                      </div>
                    </div>
                    {v.include && data.images.length > 0 && (
                      <div>
                        <span className="note">Photo de la variété :</span>
                        <div className="imp-images small">
                          <button type="button" className={`imp-img none ${v.image ? "" : "on"}`} onClick={() => setV(i, { image: null })}>Aucune</button>
                          {uniqueImgs(v.image, data.images).map((src) => (
                            <button type="button" key={src} className={`imp-img ${v.image === src ? "on" : ""}`} onClick={() => setV(i, { image: src })}>
                              <img src={proxied(src)} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn block"
            onClick={create}
            disabled={!!creating || !name.trim() || !category.trim() || parseFcfa(price) <= 0}
          >
            {creating ?? "Créer le produit"}
          </button>
          {(!category.trim() || parseFcfa(price) <= 0) && (
            <p className="note" style={{ margin: 0, textAlign: "center" }}>Indiquez la catégorie et votre prix en FCFA.</p>
          )}
        </div>
      )}
    </div>
  );
}

function uniqueImgs(current: string | null, all: string[]): string[] {
  return current && !all.includes(current) ? [current, ...all] : all;
}
