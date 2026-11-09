"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchQuartiers } from "@/lib/quartiers";

export interface Place {
  name: string;
  detail: string;
  lat: number;
  lng: number;
}

// Zone de recherche autour de Bamako (lon min, lat min, lon max, lat max).
const BBOX = "-8.45,12.3,-7.6,12.95";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; district?: string; city?: string; county?: string; type?: string };
}

/** Recherche en ligne (OpenStreetMap / Photon) pour les lieux absents de la liste. */
async function searchOnline(q: string, signal: AbortSignal): Promise<Place[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=12.64&lon=-8.0&limit=6&lang=fr&bbox=${BBOX}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return (data.features ?? [])
    .filter((f) => f.properties.name)
    .map((f) => ({
      name: f.properties.name!,
      detail: [f.properties.district, f.properties.city ?? f.properties.county].filter(Boolean).join(", ") || "Bamako",
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
}

const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Champ « Rechercher un quartier » au-dessus de la carte, avec suggestions.
export default function MapPlaceSearch({ onSelect }: { onSelect: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [online, setOnline] = useState<Place[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const term = q.trim();
  const local: Place[] = searchQuartiers(term).map((x) => ({ name: x.name, detail: x.zone, lat: x.lat, lng: x.lng }));
  // Liste locale d'abord, puis les resultats en ligne qui n'y sont pas deja.
  const seen = new Set(local.map((p) => key(p.name)));
  const items = [...local, ...online.filter((p) => !seen.has(key(p.name)))].slice(0, 8);

  useEffect(() => {
    setOnline([]);
    if (term.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchOnline(term, ctrl.signal)
        .then(setOnline)
        .catch(() => {
          /* hors ligne ou service indisponible : la liste locale suffit */
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function pick(p: Place) {
    setQ(p.name);
    setOpen(false);
    setActive(-1);
    onSelect(p);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Ne pas envoyer le formulaire de commande : choisir la suggestion.
      e.preventDefault();
      const p = items[active >= 0 ? active : 0];
      if (p) pick(p);
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="map-search" ref={boxRef}>
      <input
        className="input"
        type="search"
        placeholder="Rechercher votre quartier (ex. Faladié)…"
        aria-label="Rechercher un quartier sur la carte"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && term.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && term.length > 0 && (
        <ul className="suggest" id={listId} role="listbox">
          {items.map((p, i) => (
            <li key={`${p.name}-${p.lat}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`suggest-item ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <span className="suggest-icon" aria-hidden>📍</span>
                <span className="suggest-text">
                  <span className="suggest-label">{p.name}</span>
                  <span className="suggest-detail">{p.detail}</span>
                </span>
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="suggest-empty">Aucun quartier trouvé pour « {term} »</li>}
        </ul>
      )}
    </div>
  );
}
