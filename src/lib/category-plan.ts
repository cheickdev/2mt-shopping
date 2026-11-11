// Rangement propose des categories de la boutique : a partir du nom du
// produit et de sa categorie actuelle, on propose une categorie claire.
// Applique depuis Admin > Categories (avec apercu avant de valider).

export const CLEAN_CATEGORIES = [
  "Parfums",
  "Soins du corps",
  "Gels douche & savons",
  "Cheveux",
  "Déodorants",
  "Lèvres & maquillage",
  "Maison & anti-moustiques",
] as const;

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// L'ordre compte : la 1re regle qui correspond gagne.
const RULES: { to: string; test: (name: string, cat: string) => boolean }[] = [
  { to: "Maison & anti-moustiques", test: (n, c) => /maison|insecticide/.test(c) || /moustique|insecticide|repulsif|desodorisant|air ?fresh|belair/.test(n) },
  { to: "Parfums", test: (n, c) => /parfum|eau de toilette|eau de cologne|\belixir\b/.test(n) || /parfum/.test(c) },
  { to: "Gels douche & savons", test: (n, c) => /gel douche|shower|savon|soap/.test(n) || /savon/.test(c) },
  { to: "Cheveux", test: (n, c) => /shampo|demelant|apres[- ]shampo|cheveu|defrisant|hair/.test(n) || /shampo|demelant|cheveu/.test(c) },
  { to: "Déodorants", test: (n, c) => /deodorant|\bdeo\b|bodyspray|anti-?transpirant/.test(n) || /deodorant/.test(c) },
  { to: "Lèvres & maquillage", test: (n) => /\blip|levre|gloss|rouge a levre|maquillage|mascara|vernis|fond de teint/.test(n) },
  {
    to: "Soins du corps",
    test: (n, c) =>
      /lait|creme|cream|pommade|vaseline|huile|beurre|depilatoire|lotion|body|epiderm/.test(n) ||
      /lait|creme|pommade|huile|cosmet/.test(c),
  },
];

/** Categorie proposee pour un produit (ou null si aucune regle ne s'applique). */
export function proposeCategory(name: string, category: string): string | null {
  const n = plain(name);
  const c = plain(category);
  for (const r of RULES) if (r.test(n, c)) return r.to;
  return null;
}

/** Nettoie un nom de categorie saisi a la main. */
export function cleanCategoryName(s: string): string {
  const t = s.replace(/\s+/g, " ").trim().slice(0, 40);
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}
