"use client";

import { useState } from "react";
import { useCart } from "@/components/cart";
import SideMenu from "@/components/SideMenu";
import SearchBox from "@/components/SearchBox";
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

          <SearchBox className="search-wide" />

          <nav className="nav-actions">
            {user ? (
              <a href="/admin" className="account-link" title="Tableau de bord">
                <small>Bonjour, {user.name}</small>
                <strong><span className="hide-sm">Tableau de bord</span><span className="show-sm account-name">👤 {user.name}</span></strong>
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
          <SearchBox />
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
