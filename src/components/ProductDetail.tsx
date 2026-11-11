"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart";
import { formatFcfa } from "@/lib/money";
import RateProduct from "@/components/RateProduct";

export interface VariantView {
  id: string;
  label: string;
  stock: number;
  image: string | null;
}

export interface ProductDetailData {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string | null; // photo principale
  images: string[]; // toutes les photos du produit (la 1re = principale)
  stock: number; // stock produit (utilise seulement s'il n'y a pas de variete)
  variants: VariantView[];
  sizes: string[]; // options simples (sans stock/photo), si pas de variete
  ratingAvg: number;
  ratingCount: number;
  myRating: number | null; // note deja donnee par ce visiteur
}

export default function ProductDetail({
  product,
  whatsapp,
  deliveryFee,
  initialVariantId,
  initialOption,
}: {
  product: ProductDetailData;
  whatsapp: string;
  deliveryFee: number;
  initialVariantId?: string; // variete preselectionnee (ex. depuis la recherche)
  initialOption?: string;
}) {
  const router = useRouter();
  const { add } = useCart();

  const hasVariants = product.variants.length > 0;
  const firstAvailable = product.variants.find((v) => v.stock > 0) ?? product.variants[0] ?? null;

  const [variantId, setVariantId] = useState<string | null>(
    hasVariants ? initialVariantId ?? firstAvailable?.id ?? null : null
  );
  const [size, setSize] = useState(!hasVariants ? initialOption ?? product.sizes[0] ?? "" : "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const selectedVariant = hasVariants ? product.variants.find((v) => v.id === variantId) ?? null : null;
  // Galerie : photo de la variete choisie (si elle en a une), sinon les photos du produit.
  const [shown, setShown] = useState<string | null>(null);
  const variantImage = hasVariants ? selectedVariant?.image ?? null : null;
  const photos = [...(variantImage ? [variantImage] : []), ...product.images.filter((x) => x !== variantImage)];
  const displayImage = (shown && photos.includes(shown) ? shown : null) ?? photos[0] ?? product.image;
  const cartImage = variantImage ?? product.image;
  const availableStock = hasVariants ? selectedVariant?.stock ?? 0 : product.stock;
  const out = availableStock <= 0;
  const variantLabel = hasVariants ? selectedVariant?.label ?? "" : size;

  function doAdd(): boolean {
    if (hasVariants && !selectedVariant) return false;
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: cartImage,
      variant: variantLabel,
      variantId: hasVariants ? variantId : null,
      quantity: qty,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
    return true;
  }
  function buyNow() {
    if (doAdd()) router.push("/panier");
  }

  const waText = encodeURIComponent(
    `Bonjour 2MT - Shopping 👋\nJe veux commander :\n• ${product.name}${variantLabel ? " (" + variantLabel + ")" : ""} x${qty} — ${formatFcfa(
      product.price * qty
    )}\n\nMon nom : \nMon quartier : `
  );
  const waHref = whatsapp ? `https://wa.me/${whatsapp}?text=${waText}` : null;

  return (
    <div className="product">
      <div className="gallery-wrap">
        <div className="gallery">
          {displayImage ? <img src={displayImage} alt={product.name} /> : <div className="ph">Photo à venir</div>}
        </div>
        {photos.length > 1 && (
          <div className="thumbs" role="list">
            {photos.map((src, i) => (
              <button
                key={i}
                type="button"
                role="listitem"
                className={`thumb-btn ${src === displayImage ? "on" : ""}`}
                onClick={() => setShown(src)}
                aria-label={`Photo ${i + 1}`}
              >
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card-cat">{product.category}</div>
        <h1>{product.name}</h1>
        {selectedVariant && <div className="card-variant" style={{ fontSize: 14, marginTop: -8 }}>Variété : {selectedVariant.label}</div>}
        <div className="p-price">{formatFcfa(product.price)}</div>
        <RateProduct productId={product.id} avg={product.ratingAvg} count={product.ratingCount} mine={product.myRating} />
        {product.description && <p className="desc">{product.description}</p>}

        {hasVariants && (
          <div>
            <div className="field" style={{ marginBottom: 6 }}><label>Choisissez la variété</label></div>
            <div className="sizes">
              {product.variants.map((v) => {
                const vout = v.stock <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`size ${variantId === v.id ? "active" : ""}`}
                    onClick={() => {
                      setVariantId(v.id);
                      setShown(null);
                    }}
                    disabled={vout}
                    style={vout ? { opacity: 0.5, textDecoration: "line-through" } : undefined}
                    title={vout ? "Rupture" : `${v.stock} en stock`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
            {selectedVariant && !out && <div className="note" style={{ marginTop: 6 }}>{availableStock} disponible{availableStock > 1 ? "s" : ""}</div>}
          </div>
        )}

        {!hasVariants && product.sizes.length > 0 && (
          <div>
            <div className="field" style={{ marginBottom: 6 }}><label>Choisissez une option</label></div>
            <div className="sizes">
              {product.sizes.map((s) => (
                <button key={s} type="button" className={`size ${size === s ? "active" : ""}`} onClick={() => setSize(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="note">Quantité</span>
          <div className="qty">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Moins">–</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(availableStock || 99, q + 1))} aria-label="Plus">+</button>
          </div>
        </div>

        {out ? (
          <div className="error">{hasVariants ? "Cette variété est en rupture." : "Cet article est en rupture de stock."}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn block" onClick={buyNow}>Commander — {formatFcfa(product.price * qty)}</button>
            <button className="btn ghost block" onClick={doAdd}>{added ? "Ajouté au panier ✓" : "Ajouter au panier"}</button>
            {waHref && (
              <a className="btn wa block" href={waHref} target="_blank" rel="noopener noreferrer">Commander sur WhatsApp</a>
            )}
          </div>
        )}

        <p className="note">🛵 Livraison à Bamako · 💵 Paiement à la livraison · Frais : {deliveryFee > 0 ? formatFcfa(deliveryFee) : "selon la distance, calculés au panier"}</p>
      </div>
    </div>
  );
}
