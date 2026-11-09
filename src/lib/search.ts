// Recherche du catalogue, partagee par la page de resultats et les suggestions
// pendant la saisie. Insensible aux accents et a la casse ("serum" trouve
// "Sérum"), et elle porte aussi sur les varietes ("vanille" trouve la variete
// "Vanille 50ml" et permet d'ouvrir directement cette variete).

export interface SearchableProduct {
  slug: string;
  name: string;
  category: string;
  description: string;
  sizes: string; // options simples "38,39,40"
  variants: { id: string; label: string }[];
}

export interface ProductMatch {
  /** Varietes dont le nom correspond a la recherche (les plus pertinentes d'abord). */
  variants: { id: string; label: string }[];
  /** Options simples (champ "sizes") qui correspondent. */
  options: string[];
  /** Score de pertinence (plus haut = mieux). */
  score: number;
}

export const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function queryWords(q: string): string[] {
  return norm(q).split(/\s+/).filter(Boolean);
}

const splitSizes = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** null si le produit ne correspond pas ; sinon les varietes/options trouvees. */
export function matchProduct(p: SearchableProduct, words: string[]): ProductMatch | null {
  if (words.length === 0) return null;
  const sizes = splitSizes(p.sizes);
  const base = norm(`${p.name} ${p.category} ${p.description}`);
  const hay = `${base} ${norm(sizes.join(" "))} ${norm(p.variants.map((v) => v.label).join(" "))}`;
  if (!words.every((w) => hay.includes(w))) return null;

  // Varietes / options qui contiennent au moins un des mots recherches.
  const hits = (label: string) => words.filter((w) => norm(label).includes(w)).length;
  const variants = p.variants
    .map((v) => ({ v, n: hits(v.label) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.v);
  const options = sizes.filter((s) => hits(s) > 0);

  const name = norm(p.name);
  const q = words.join(" ");
  let score = 0;
  if (name.startsWith(q)) score += 6;
  else if (name.includes(q)) score += 4;
  score += words.filter((w) => name.includes(w)).length * 2;
  score += words.filter((w) => norm(p.category).includes(w)).length;
  if (variants.length || options.length) score += 1;
  return { variants, options, score };
}

/** Lien vers la fiche, avec la variete (ou l'option) preselectionnee. */
export function productHref(slug: string, sel?: { variantId?: string; option?: string }): string {
  const base = `/produit/${slug}`;
  if (sel?.variantId) return `${base}?v=${encodeURIComponent(sel.variantId)}`;
  if (sel?.option) return `${base}?opt=${encodeURIComponent(sel.option)}`;
  return base;
}

export interface Suggestion {
  kind: "product" | "variant" | "category";
  label: string; // texte principal
  detail: string; // texte secondaire (categorie, prix…)
  href: string;
}
