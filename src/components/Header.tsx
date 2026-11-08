"use client";

import { useCart } from "@/components/cart";

export default function Header({ shopName }: { shopName: string }) {
  const { count } = useCart();
  const [first, ...rest] = shopName.split(" ");
  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="/" className="logo">
          <b>{first}</b> <span className="tag">{rest.join(" ")}</span>
        </a>
        <nav className="nav-actions">
          <a href="/?cat=CHAUSSURES">Chaussures</a>
          <a href="/?cat=COSMETIQUES">Cosmétiques</a>
          <a href="/panier" className="cart-link" aria-label="Panier">
            Panier
            {count > 0 && <span className="cart-badge">{count}</span>}
          </a>
        </nav>
      </div>
    </header>
  );
}
