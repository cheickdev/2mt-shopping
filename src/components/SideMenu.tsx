"use client";

import { useEffect, useState } from "react";
import type { MenuCategory, MenuUser } from "@/lib/menu";
import ThemeToggle from "@/components/ThemeToggle";

// Menu lateral (☰) : categories deroulables, aide, et espace administrateur.
export default function SideMenu({
  open,
  onClose,
  categories,
  user,
  whatsapp,
}: {
  open: boolean;
  onClose: () => void;
  categories: MenuCategory[];
  user: MenuUser | null;
  whatsapp: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Fermer avec Echap + bloquer le defilement de la page quand le menu est ouvert.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/";
  }

  const wa = whatsapp.replace(/\D/g, "");

  return (
    <div className={`drawer-root ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="drawer-head">
          <span className="drawer-avatar" aria-hidden>{user ? user.name.charAt(0).toUpperCase() : "👋"}</span>
          {user ? (
            <a href="/admin">Bonjour, {user.name}</a>
          ) : (
            <span className="drawer-hello">Bonjour, bienvenue</span>
          )}
          <button className="drawer-close" onClick={onClose} aria-label="Fermer le menu">✕</button>
        </div>

        <div className="drawer-body">
          <section>
            <h3>Acheter par catégorie</h3>
            <a className="drawer-link" href="/">Tous les articles</a>
            {categories.length === 0 && <p className="note drawer-pad">Aucune catégorie pour le moment.</p>}
            {categories.map((c) => {
              const isOpen = expanded === c.name;
              return (
                <div key={c.name} className={`drawer-cat ${isOpen ? "open" : ""}`}>
                  <button
                    className="drawer-link drawer-toggle"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : c.name)}
                  >
                    <span>{c.name}</span>
                    <span className="drawer-count">{c.count}</span>
                    <span className="chev" aria-hidden>›</span>
                  </button>
                  {isOpen && (
                    <div className="drawer-sub">
                      <a href={`/?cat=${encodeURIComponent(c.name)}`} className="drawer-sublink strong">
                        Voir tout « {c.name} »
                      </a>
                      {c.products.map((p) => (
                        <a key={p.slug} href={`/produit/${p.slug}`} className="drawer-sublink">{p.name}</a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <section>
            <h3>Aide et services</h3>
            <a className="drawer-link" href="/panier">Mon panier</a>
            {wa && (
              <a className="drawer-link" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                Nous contacter sur WhatsApp
              </a>
            )}
            <p className="note drawer-pad">Livraison à Bamako · Paiement à la livraison</p>
          </section>

          <section>
            <h3>Affichage</h3>
            <ThemeToggle />
          </section>

          {/* Espace administrateur : visible uniquement quand un admin est connecte. */}
          {user && (
            <section>
              <h3>Espace administrateur</h3>
              <a className="drawer-link" href="/admin">Tableau de bord</a>
              <a className="drawer-link" href="/admin/produits">Produits</a>
              <a className="drawer-link" href="/admin/categories">Catégories</a>
              <a className="drawer-link" href="/admin/commandes">Commandes</a>
              <a className="drawer-link" href="/admin/gestion">Gestion</a>
              {user.role === "owner" && <a className="drawer-link" href="/admin/parametres">Paramètres</a>}
              <a className="drawer-link" href="/admin/compte">Mon compte ({user.name})</a>
              <button className="drawer-link" onClick={logout}>Se déconnecter</button>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
