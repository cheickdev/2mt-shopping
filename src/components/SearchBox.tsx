"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Suggestion } from "@/lib/search";

const ICON = { product: "🛍️", variant: "🎨", category: "🗂️" } as const;

// Barre de recherche avec suggestions pendant la saisie (articles, varietes,
// categories). Cliquer une variete ouvre directement la fiche sur cette variete.
export default function SearchBox({ className = "" }: { className?: string }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLFormElement>(null);
  const listId = useId();

  // Recherche (avec un petit delai pour ne pas interroger a chaque touche).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/recherche?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await res.json();
        setItems(data.suggestions ?? []);
        setActive(-1);
      } catch {
        /* requete annulee ou hors ligne */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Fermer en touchant ailleurs.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    window.location.href = href;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      go(items[active].href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const term = q.trim();
  const showList = open && term.length > 0;

  return (
    <form action="/" method="get" className={`search ${className}`} role="search" ref={boxRef}>
      <input
        name="q"
        className="input"
        placeholder="Rechercher un article…"
        aria-label="Rechercher"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <button className="search-btn" aria-label="Lancer la recherche">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>

      {showList && (
        <ul className="suggest" id={listId} role="listbox">
          {items.map((s, i) => (
            <li key={s.href + i} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <a
                href={s.href}
                className={`suggest-item ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => setOpen(false)}
              >
                <span className="suggest-icon" aria-hidden>{ICON[s.kind]}</span>
                <span className="suggest-text">
                  <span className="suggest-label">{s.label}</span>
                  <span className="suggest-detail">{s.kind === "variant" ? `Variété · ${s.detail}` : s.detail}</span>
                </span>
              </a>
            </li>
          ))}
          {!loading && items.length === 0 && <li className="suggest-empty">Aucune suggestion pour « {term} »</li>}
          <li>
            <a href={`/?q=${encodeURIComponent(term)}`} className="suggest-all" onClick={() => setOpen(false)}>
              Voir tous les résultats pour « {term} »
            </a>
          </li>
        </ul>
      )}
    </form>
  );
}
