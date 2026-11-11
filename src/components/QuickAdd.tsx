"use client";

import { useState } from "react";
import { useCart } from "@/components/cart";

// Bouton panier pose sur la photo d'une carte produit : ajoute 1 article
// sans ouvrir la fiche. Si le produit demande un choix (variete, pointure…),
// le bouton ouvre la fiche pour choisir.
export default function QuickAdd({
  id,
  slug,
  name,
  price,
  image,
  href,
  needsChoice,
  available,
}: {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  href: string;
  needsChoice: boolean;
  available: boolean;
}) {
  const { add } = useCart();
  const [done, setDone] = useState(false);

  if (!available) return null;
  if (needsChoice) {
    return (
      <a className="quick-add" href={href} aria-label={`Choisir la variété de ${name}`} title="Choisir la variété">
        <CartIcon />
        <span className="quick-plus">…</span>
      </a>
    );
  }
  return (
    <button
      type="button"
      className={`quick-add ${done ? "done" : ""}`}
      aria-label={`Ajouter ${name} au panier`}
      title="Ajouter au panier"
      onClick={() => {
        add({ productId: id, slug, name, price, image, variant: "", variantId: null, quantity: 1 });
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? <span className="quick-ok">✓</span> : <CartIcon />}
      {!done && <span className="quick-plus">+</span>}
      {done && <span className="quick-toast">Ajouté !</span>}
    </button>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3h2.6l2.4 11.4a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 7H6" />
    </svg>
  );
}
