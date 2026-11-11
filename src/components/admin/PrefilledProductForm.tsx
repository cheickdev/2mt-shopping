"use client";

import { useEffect, useState } from "react";
import { parseFcfa } from "@/lib/money";
import { remoteToDataUrl } from "@/components/admin/imageResize";
import GalleryEditor from "@/components/admin/GalleryEditor";

export interface PrefillValues {
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  description: string;
  unit?: string;
  photoUrl?: string; // photo d'un autre site, recuperee automatiquement a l'ouverture
}

// Fiche produit pre-remplie (import depuis la caisse, produits a venir…),
// a verifier avant creation. `extra` est envoye tel quel (ex. caisseRef).
export default function PrefilledProductForm({
  title,
  intro,
  initial,
  extra,
  onCancel,
  onCreated,
}: {
  title: string;
  intro?: React.ReactNode;
  initial: PrefillValues;
  extra?: Record<string, unknown>;
  onCancel: () => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [price, setPrice] = useState(initial.price ? String(initial.price) : "");
  const [cost, setCost] = useState(initial.cost ? String(initial.cost) : "");
  const [stock, setStock] = useState(String(Math.max(0, initial.stock)));
  const [description, setDescription] = useState(initial.description);
  const [gallery, setGallery] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Photo trouvee ailleurs : on la recupere (via le relais du serveur).
  useEffect(() => {
    if (!initial.photoUrl) return;
    let alive = true;
    setPhotoNote("Récupération de la photo…");
    remoteToDataUrl(initial.photoUrl)
      .then((url) => {
        if (!alive) return;
        setGallery((g) => (g.length ? g : [url]));
        setPhotoNote(null);
      })
      .catch(() => alive && setPhotoNote("Photo non récupérable : ajoutez-en une avec les boutons ci-dessous."));
    return () => {
      alive = false;
    };
  }, [initial.photoUrl]);

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
          ...extra,
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
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button className="btn ghost sm" onClick={onCancel}>← Retour</button>
      </div>
      {intro && <p className="note" style={{ margin: "6px 0 10px" }}>{intro}</p>}
      <div className="pe-form" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="field pe-full">
          <label>Nom</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field pe-full">
          <label>Catégorie sur le site</label>
          <input className="input" list="cat-suggestions" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex. Soins du corps" />
          <span className="note">Choisissez de préférence une catégorie existante (liste proposée).</span>
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
          <label>Stock{initial.unit ? ` (${initial.unit})` : ""}</label>
          <input className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <div className="field pe-full">
          <label>Photos ({gallery.length})</label>
          {photoNote && <span className="note">{photoNote}</span>}
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
