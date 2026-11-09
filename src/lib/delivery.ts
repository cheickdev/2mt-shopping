// Calcul des frais de livraison selon la distance entre le point de depart
// (regle par l'admin dans Parametres) et l'adresse choisie par le client sur
// la carte. Fichier partage client/serveur : pas d'import serveur ici.
//
// Distance = ligne droite (« a vol d'oiseau ») entre les deux points.

export interface LatLng {
  lat: number;
  lng: number;
}

// Paliers : jusqu'a maxKm inclus -> fee (FCFA). Au-dela du dernier palier,
// le prix est a convenir avec le vendeur.
export const DELIVERY_TIERS: { maxKm: number; fee: number }[] = [
  { maxKm: 10, fee: 1000 },
  { maxKm: 15, fee: 1500 },
  { maxKm: 25, fee: 2000 },
];
export const MAX_DELIVERY_KM = DELIVERY_TIERS[DELIVERY_TIERS.length - 1].maxKm;

// Centre de Bamako : position initiale de la carte.
export const BAMAKO: LatLng = { lat: 12.6392, lng: -8.0029 };

export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/** Distance en km entre deux points (formule de haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type DeliveryQuote =
  | { kind: "fee"; fee: number; km: number | null } // km null = pas de point de depart regle (tarif par defaut)
  | { kind: "contact"; km: number }; // trop loin : prix a convenir avec le vendeur

/**
 * Frais de livraison pour une destination.
 * - Sans point de depart regle : tarif par defaut des Parametres.
 * - Sinon : selon les paliers de distance ; au-dela, « a convenir ».
 */
export function quoteDelivery(origin: LatLng | null, dest: LatLng, defaultFee: number): DeliveryQuote {
  if (!origin) return { kind: "fee", fee: defaultFee, km: null };
  const km = distanceKm(origin, dest);
  for (const t of DELIVERY_TIERS) {
    if (km <= t.maxKm) return { kind: "fee", fee: t.fee, km };
  }
  return { kind: "contact", km };
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

export function mapsLink(p: LatLng): string {
  return `https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}
