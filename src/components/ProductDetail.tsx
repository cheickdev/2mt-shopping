"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart";
import { formatFcfa } from "@/lib/money";

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
  stock: number; // stock produit (utilise seulement s'il n'y a pas de variete)
  variants: VariantView[];
  sizes: string[]; // options simples (sans stock/photo), si pas de variete
}

export default function ProductDetail({ product, whatsapp, deliveryFee }: { product: ProductDetailData; whatsapp: string; deliveryFee: number }) {
  const router = useRouter();
  const { add } = useCart();

  const hasVariants = product.variants.length > 0;
  const firstAvailable = product.variants.find((v) => v.stock > 0) ?? product.variants[0] ?? null;

  const [variantId, setVariantId] = useState<string | null>(hasVariants ? firstAvailable?.id ?? null : null);
  const [size, setSize] = useState(!hasVariants ? product.sizes[0] ?? "" : "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const selectedVariant = hasVariants ? product.variants.find((v) => v.id === variantId) ?? null : null;
  const displayImage = (hasVariants ? selectedVariant?.image : null) ?? product.image;
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
      image: displayImage,
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
      <div className="gallery">
        {displayImage ? <img src={displayImage} alt={product.name} /> : <div className="ph">Photo à venir</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card-cat">{product.category}</div>
        <h1>{product.name}</h1>
        <div className="p-price">{formatFcfa(product.price)}</div>
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
                    onClick={() => setVariantId(v.id)}
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

        <p className="note">🛵 Livraison à Bamako · 💵 Paiement à la livraison · Frais : {formatFcfa(deliveryFee)}</p>
      </div>
    </div>
  );
}
