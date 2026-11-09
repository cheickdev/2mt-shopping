"use client";

import { useState } from "react";
import { useCart } from "@/components/cart";
import SideMenu from "@/components/SideMenu";
import type { MenuCategory, MenuUser } from "@/lib/menu";

export default function Header({
  shopName,
  categories = [],
  user = null,
  whatsapp = "",
}: {
  shopName: string;
  categories?: MenuCategory[];
  user?: MenuUser | null;
  whatsapp?: string;
}) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [first, ...rest] = shopName.split(" ");

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <button className="burger" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}>
            <span /><span /><span />
          </button>
          <a href="/" className="logo">
            <b>{first}</b> <span className="tag">{rest.join(" ")}</span>
          </a>

          <form action="/" method="get" className="search search-wide" role="search">
            <input name="q" className="input" placeholder="Rechercher un article…" aria-label="Rechercher" />
            <button className="search-btn" aria-label="Lancer la recherche"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></button>
          </form>

          <nav className="nav-actions">
            {user ? (
              <a href="/admin" className="account-link" title="Tableau de bord">
                <small>Bonjour, {user.name}</small>
                <strong><span className="hide-sm">Tableau de bord</span><span className="show-sm">Admin</span></strong>
              </a>
            ) : (
              <a href="/admin/login" className="account-link">
                <small>Bonjour</small>
                <strong>Se connecter</strong>
              </a>
            )}
            <a href="/panier" className="cart-link" aria-label="Panier">
              Panier
              {count > 0 && <span className="cart-badge">{count}</span>}
            </a>
          </nav>
        </div>

        <div className="nav-search-row">
          <form action="/" method="get" className="search" role="search">
            <input name="q" className="input" placeholder="Rechercher un article…" aria-label="Rechercher" />
            <button className="search-btn" aria-label="Lancer la recherche"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></button>
          </form>
        </div>

        {categories.length > 0 && (
          <div className="cat-strip">
            <div className="cat-strip-inner">
              <button className="cat-all" onClick={() => setOpen(true)}>☰ Toutes</button>
              {categories.map((c) => (
                <a key={c.name} href={`/?cat=${encodeURIComponent(c.name)}`}>{c.name}</a>
              ))}
            </div>
          </div>
        )}
      </header>

      <SideMenu
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        user={user}
        whatsapp={whatsapp}
      />
    </>
  );
}
