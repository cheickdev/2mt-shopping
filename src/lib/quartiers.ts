// Quartiers de Bamako et environs, pour la recherche sur la carte.
// Coordonnees APPROXIMATIVES du centre de chaque quartier : elles servent
// seulement a centrer la carte ; le client touche ensuite son point exact.
// Pour corriger ou ajouter un quartier : modifier cette liste.

export interface Quartier {
  name: string;
  lat: number;
  lng: number;
  zone: string; // commune / localite, affichee en petit
}

const Q = (name: string, lat: number, lng: number, zone: string): Quartier => ({ name, lat, lng, zone });

export const QUARTIERS: Quartier[] = [
  // Commune I (rive gauche, nord-est)
  Q("Banconi", 12.68, -7.96, "Commune I"),
  Q("Boulkassoumbougou", 12.675, -7.94, "Commune I"),
  Q("Djélibougou", 12.665, -7.95, "Commune I"),
  Q("Doumanzana", 12.68, -7.93, "Commune I"),
  Q("Fadjiguila", 12.682, -7.945, "Commune I"),
  Q("Korofina Nord", 12.665, -7.965, "Commune I"),
  Q("Korofina Sud", 12.658, -7.968, "Commune I"),
  Q("Sikoroni", 12.68, -7.975, "Commune I"),
  Q("Sotuba", 12.66, -7.92, "Commune I"),
  // Commune II
  Q("Bagadadji", 12.643, -7.988, "Commune II"),
  Q("Bozola", 12.648, -7.982, "Commune II"),
  Q("Hippodrome", 12.656, -7.98, "Commune II"),
  Q("Médina Coura", 12.651, -7.989, "Commune II"),
  Q("Missira", 12.655, -7.992, "Commune II"),
  Q("Niaréla", 12.645, -7.978, "Commune II"),
  Q("Quinzambougou", 12.647, -7.972, "Commune II"),
  Q("Zone industrielle", 12.64, -7.965, "Commune II"),
  // Commune III
  Q("Bamako-Coura", 12.645, -8.0, "Commune III"),
  Q("Centre commercial", 12.64, -7.998, "Commune III"),
  Q("Quartier du Fleuve", 12.636, -7.995, "Commune III"),
  Q("Dravéla", 12.648, -8.008, "Commune III"),
  Q("Bolibana", 12.651, -8.017, "Commune III"),
  Q("Ouolofobougou", 12.647, -8.015, "Commune III"),
  Q("Dar Salam", 12.646, -8.006, "Commune III"),
  Q("Koulouba", 12.665, -8.001, "Commune III"),
  Q("Point G", 12.672, -8.014, "Commune III"),
  Q("Badialan", 12.65, -8.01, "Commune III"),
  Q("N'Tomikorobougou", 12.655, -8.005, "Commune III"),
  // Commune IV (ouest)
  Q("Hamdallaye", 12.644, -8.03, "Commune IV"),
  Q("Hamdallaye ACI 2000", 12.627, -8.033, "Commune IV"),
  Q("Lafiabougou", 12.643, -8.047, "Commune IV"),
  Q("Djicoroni Para", 12.63, -8.045, "Commune IV"),
  Q("Sébénikoro", 12.637, -8.07, "Commune IV"),
  Q("Samé", 12.662, -8.037, "Commune IV"),
  Q("Taliko", 12.64, -8.06, "Commune IV"),
  Q("Lassa", 12.66, -8.06, "Commune IV"),
  // Commune V (rive droite)
  Q("Badalabougou", 12.625, -7.997, "Commune V"),
  Q("Quartier Mali", 12.615, -7.995, "Commune V"),
  Q("Torokorobougou", 12.615, -8.01, "Commune V"),
  Q("Baco Djicoroni", 12.6, -8.02, "Commune V"),
  Q("Baco Djicoroni ACI", 12.595, -8.025, "Commune V"),
  Q("Daoudabougou", 12.605, -7.975, "Commune V"),
  Q("Sabalibougou", 12.595, -7.975, "Commune V"),
  Q("Kalaban Coura", 12.59, -8.0, "Commune V"),
  Q("Kalaban Coura ACI", 12.585, -8.01, "Commune V"),
  Q("Garantibougou", 12.58, -7.99, "Commune V"),
  // Commune VI (rive droite, est)
  Q("Faladié", 12.6, -7.96, "Commune VI"),
  Q("Magnambougou", 12.605, -7.945, "Commune VI"),
  Q("Sogoniko", 12.59, -7.955, "Commune VI"),
  Q("Banankabougou", 12.595, -7.935, "Commune VI"),
  Q("Niamakoro", 12.58, -7.98, "Commune VI"),
  Q("Yirimadio", 12.59, -7.92, "Commune VI"),
  Q("Missabougou", 12.61, -7.915, "Commune VI"),
  Q("Sokorodji", 12.6, -7.91, "Commune VI"),
  Q("Sénou", 12.545, -7.95, "Commune VI"),
  Q("Dianéguéla", 12.585, -7.94, "Commune VI"),
  // Environs
  Q("Kalaban Coro", 12.565, -8.02, "Kalaban Coro"),
  Q("Niamana", 12.565, -7.95, "Kalaban Coro"),
  Q("Kabala", 12.565, -8.07, "Kalaban Coro"),
  Q("Moribabougou", 12.69, -7.88, "Moribabougou"),
  Q("Kati", 12.744, -8.072, "Kati"),
  Q("Samanko", 12.55, -8.1, "Environs"),
  Q("Siby", 12.38, -8.33, "Environs"),
];

const norm = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Quartiers correspondant a la saisie (debut de nom en premier). */
export function searchQuartiers(q: string, limit = 6): Quartier[] {
  const n = norm(q);
  if (!n) return [];
  const words = n.split(" ");
  return QUARTIERS.map((x) => {
    const name = norm(x.name);
    if (!words.every((w) => name.includes(w) || norm(x.zone).includes(w))) return null;
    const score = name.startsWith(n) ? 3 : name.split(" ").some((part) => part.startsWith(words[0])) ? 2 : 1;
    return { x, score };
  })
    .filter((r): r is { x: Quartier; score: number } => r !== null)
    .sort((a, b) => b.score - a.score || a.x.name.localeCompare(b.x.name, "fr"))
    .slice(0, limit)
    .map((r) => r.x);
}
