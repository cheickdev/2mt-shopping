"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker, Polyline } from "leaflet";
import { BAMAKO, type LatLng } from "@/lib/delivery";
import MapPlaceSearch, { type Place } from "@/components/MapPlaceSearch";

// Carte (OpenStreetMap, sans cle API) pour choisir un point :
// rechercher son quartier pour y centrer la carte, puis toucher la carte ou
// deplacer l'epingle, ou utiliser « Ma position ».
// Si `origin` est fourni (point de depart de la boutique), on l'affiche avec
// une ligne jusqu'au point choisi.
export default function LocationPicker({
  value,
  onChange,
  origin = null,
  height = 300,
  pinLabel = "Livraison",
  onPlace,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  origin?: LatLng | null;
  height?: number;
  pinLabel?: string;
  onPlace?: (p: Place) => void; // quartier choisi dans la recherche
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [placeHint, setPlaceHint] = useState<string | null>(null);
  const [full, setFull] = useState(false);

  // Plein ecran : la carte occupe tout l'ecran (fonctionne aussi sur iPhone).
  useEffect(() => {
    // Leaflet doit recalculer sa taille apres le changement de dimensions.
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 50);
    if (!full) return () => clearTimeout(t);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [full]);

  // Quartier choisi : on centre la carte dessus ; le client touche ensuite son point exact.
  function goToPlace(p: Place) {
    mapRef.current?.setView([p.lat, p.lng], 15);
    setPlaceHint(p.name);
    onPlace?.(p);
  }

  // Creation de la carte (Leaflet ne fonctionne que dans le navigateur).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || mapRef.current) return;
      LRef.current = L;
      const start = value ?? origin ?? BAMAKO;
      const map = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(
        [start.lat, start.lng],
        value || origin ? 14 : 12
      );
      // Vue satellite par defaut (Esri World Imagery, sans cle API) avec les
      // noms des lieux par-dessus ; bouton en haut a droite pour passer au plan.
      const esri = "https://server.arcgisonline.com/ArcGIS/rest/services";
      const satellite = L.layerGroup([
        L.tileLayer(`${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
          maxZoom: 19,
          maxNativeZoom: 18,
          attribution: "Imagerie &copy; Esri, Maxar, Earthstar Geographics",
        }),
        L.tileLayer(`${esri}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, {
          maxZoom: 19,
          maxNativeZoom: 18,
        }),
        L.tileLayer(`${esri}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, {
          maxZoom: 19,
          maxNativeZoom: 18,
          opacity: 0.6,
        }),
      ]).addTo(map);
      const plan = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });
      L.control.layers({ Satellite: satellite, Plan: plan }, undefined, { position: "topright" }).addTo(map);
      map.on("click", (e) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      lineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Point de depart (boutique).
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !origin) return;
    const m = L.marker([origin.lat, origin.lng], {
      icon: L.divIcon({ className: "map-pin-wrap", html: '<div class="map-pin shop">🏬</div>', iconSize: [34, 34], iconAnchor: [17, 17] }),
      interactive: false,
      keyboard: false,
    }).addTo(map);
    return () => {
      m.remove();
    };
  }, [ready, origin?.lat, origin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Epingle du point choisi + ligne depuis le point de depart.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      lineRef.current?.remove();
      lineRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const m = L.marker([value.lat, value.lng], {
        draggable: true,
        icon: L.divIcon({
          className: "map-pin-wrap",
          html: `<div class="map-pin"><span>📍</span><small>${pinLabel}</small></div>`,
          iconSize: [40, 48],
          iconAnchor: [20, 44],
        }),
      }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng([value.lat, value.lng]);
    }
    if (origin) {
      const pts: [number, number][] = [
        [origin.lat, origin.lng],
        [value.lat, value.lng],
      ];
      if (lineRef.current) lineRef.current.setLatLngs(pts);
      else lineRef.current = L.polyline(pts, { color: "#b11f5c", weight: 3, dashArray: "6 6", interactive: false }).addTo(map);
    }
  }, [ready, value?.lat, value?.lng, origin?.lat, origin?.lng, pinLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  function locateMe() {
    if (!navigator.geolocation) {
      setGeoError("La localisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChangeRef.current(p);
        if (origin) {
          // Cadre la boutique et l'adresse du client ensemble.
          mapRef.current?.fitBounds(
            [
              [origin.lat, origin.lng],
              [p.lat, p.lng],
            ],
            { padding: [40, 40], maxZoom: 16 }
          );
        } else {
          mapRef.current?.setView([p.lat, p.lng], 16);
        }
      },
      () => {
        setLocating(false);
        setGeoError("Position introuvable. Autorisez la localisation ou touchez la carte.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className={`map-picker ${full ? "map-full" : ""}`}>
      {full && (
        <div className="map-full-bar">
          <strong>Choisissez votre emplacement</strong>
          <button type="button" className="btn sm" onClick={() => setFull(false)} aria-label="Quitter le plein écran">
            ✕ Quitter
          </button>
        </div>
      )}
      <MapPlaceSearch onSelect={goToPlace} />
      {placeHint && !value && (
        <div className="map-hint">Carte centrée sur {placeHint} : touchez maintenant votre emplacement exact.</div>
      )}
      <div className="map-box-wrap" style={full ? undefined : { height }}>
        <div ref={el} className="map-box" />
        {!full && (
          <button type="button" className="map-full-btn" onClick={() => setFull(true)} aria-label="Afficher la carte en plein écran">
            ⛶ Plein écran
          </button>
        )}
      </div>
      <div className="map-actions">
        <button type="button" className="btn ghost sm" onClick={locateMe} disabled={locating}>
          {locating ? "Localisation…" : "📍 Ma position actuelle"}
        </button>
        {full && value ? (
          <button type="button" className="btn sm" onClick={() => setFull(false)}>
            ✓ Valider cet emplacement
          </button>
        ) : (
          <span className="note">ou touchez la carte / déplacez l'épingle</span>
        )}
      </div>
      {geoError && <div className="note" style={{ color: "var(--danger)" }}>{geoError}</div>}
    </div>
  );
}
