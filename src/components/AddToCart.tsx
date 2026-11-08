"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart";
import { formatFcfa } from "@/lib/money";

export interface AddToCartProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  sizes: string[];
  stock: number;
}

export default function AddToCart({ product, whatsapp }: { product: AddToCartProduct; whatsapp: string }) {
  const router = useRouter();
  const { add } = useCart();
  const [variant, setVariant] = useState(product.sizes[0] ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [needVariant, setNeedVariant] = useState(false);

  const out = product.stock <= 0;

  function doAdd(): boolean {
    if (product.sizes.length > 0 && !variant) {
      setNeedVariant(true);
      return false;
    }
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
      variant,
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
    `Bonjour 2MT - Shopping 👋\nJe veux commander :\n• ${product.name}${variant ? " (" + variant + ")" : ""} x${qty} — ${formatFcfa(
      product.price * qty
    )}\n\nMon nom : \nMon quartier : `
  );
  const waHref = whatsapp ? `https://wa.me/${whatsapp}?text=${waText}` : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {product.sizes.length > 0 && (
        <div>
          <div className="field" style={{ marginBottom: 6 }}>
            <label>Choisissez {product.sizes.length > 4 ? "la pointure" : "la variante"}</label>
          </div>
          <div className="sizes">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                className={`size ${variant === s ? "active" : ""}`}
                onClick={() => {
                  setVariant(s);
                  setNeedVariant(false);
                }}
              >
                {s}
              </button>
            ))}
          </div>
          {needVariant && <div className="error" style={{ marginTop: 8 }}>Sélectionnez une option.</div>}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="note">Quantité</span>
        <div className="qty">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Moins">–</button>
          <span>{qty}</span>
          <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Plus">+</button>
        </div>
      </div>

      {out ? (
        <div className="error">Cet article est en rupture de stock.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn block" onClick={buyNow}>Commander — {formatFcfa(product.price * qty)}</button>
          <button className="btn ghost block" onClick={doAdd}>
            {added ? "Ajouté au panier ✓" : "Ajouter au panier"}
          </button>
          {waHref && (
            <a className="btn wa block" href={waHref} target="_blank" rel="noopener noreferrer">
              Commander sur WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}
