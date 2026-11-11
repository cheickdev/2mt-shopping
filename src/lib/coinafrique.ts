// Tendances a Bamako d'apres les annonces de CoinAfrique Mali.
//
// On respecte le fichier robots.txt du site : les pages de recherche sont
// interdites aux robots, mais les pages de categorie sont permises. On lit donc
// quelques pages d'une categorie (annonces les plus recentes), puis on cherche
// et on compte NOUS-MEMES dans ces annonces. Resultat garde en memoire 6 h
// pour ne pas solliciter le site a chaque recherche.

export const COINAFRIQUE_CATEGORIES: { slug: string; label: string }[] = [
  { slug: "cosmetique-et-parfums", label: "Cosmétiques & parfums" },
  { slug: "chaussures-femme", label: "Chaussures femme" },
  { slug: "chaussures-homme", label: "Chaussures homme" },
  { slug: "accessoires-cheveux-coiffure-et-cils", label: "Cheveux, coiffure & cils" },
];

export interface LocalAd {
  id: string;
  title: string;
  price: number; // FCFA (0 = prix non indique)
  imageUrl: string;
  link: string;
  age: string; // ex. "6 jours"
  ageDays: number;
  location: string;
}

export interface LocalTerm {
  term: string; // mot (produit ou marque) tres present dans les annonces
  count: number; // nombre d'annonces qui le contiennent
  medianPrice: number | null;
}

// COINAFRIQUE_BASE : uniquement pour les tests (faux serveur).
const BASE = process.env.COINAFRIQUE_BASE || "https://ml.coinafrique.com";
const PAGES = 4; // ~84 annonces par page
const TTL = 6 * 60 * 60 * 1000;
const UA = "Mozilla/5.0 (compatible; 2MT-Shopping/1.0; +https://www.2mt.shop)";

const cache = ((globalThis as unknown as { __coinafrique?: Map<string, { at: number; ads: LocalAd[] }> }).__coinafrique ??= new Map());

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function ageToDays(n: string, unit: string): number {
  const v = parseInt(n, 10) || 1;
  const u = unit.toLowerCase();
  if (u.startsWith("min") || u.startsWith("heure") || u.startsWith("sec")) return 0;
  if (u.startsWith("jour")) return v;
  if (u.startsWith("semaine")) return v * 7;
  if (u.startsWith("mois")) return v * 30;
  if (u.startsWith("an")) return v * 365;
  return v;
}

/** Lit les annonces d'une page de categorie (HTML de CoinAfrique). */
export function parseAds(html: string): LocalAd[] {
  const out: LocalAd[] = [];
  const blocks = html.split('<div class="card ad__card').slice(1);
  for (const b of blocks) {
    const id = /data-post-id="(\d+)"/.exec(b)?.[1];
    const title = /data-ad-title="([^"]*)"/.exec(b)?.[1];
    const href = /<a class="card-image[^"]*" href="([^"]+)"/.exec(b)?.[1];
    if (!id || !title || !href) continue;
    const price = parseInt(/data-ad-price="(\d+)"/.exec(b)?.[1] ?? "0", 10) || 0;
    const img = /<img class="ad__card-img" src="([^"]+)"/.exec(b)?.[1] ?? "";
    const time = /<span class="time">([^<]*)<\/span><span>([^<]*)<\/span>/.exec(b);
    const loc = /location_on<\/i><span>([^<]*)</.exec(b)?.[1] ?? "";
    out.push({
      id,
      title: decode(title).slice(0, 200),
      price,
      imageUrl: img.startsWith("https://") ? img : "",
      link: href.startsWith("/") ? BASE + href : href,
      age: time ? `${time[1].trim()} ${time[2].trim()}` : "",
      ageDays: time ? ageToDays(time[1], time[2]) : 999,
      location: decode(loc),
    });
  }
  return out;
}

export async function fetchCategory(slug: string): Promise<LocalAd[]> {
  if (!COINAFRIQUE_CATEGORIES.some((c) => c.slug === slug)) throw new Error("Catégorie inconnue.");
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL) return hit.ads;
  const seen = new Set<string>();
  const ads: LocalAd[] = [];
  for (let p = 1; p <= PAGES; p++) {
    let html = "";
    try {
      const res = await fetch(`${BASE}/categorie/${slug}${p > 1 ? `?page=${p}` : ""}`, {
        headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        if (p === 1) throw new Error(`CoinAfrique ne répond pas (${res.status}). Réessayez plus tard.`);
        break;
      }
      html = await res.text();
    } catch (e) {
      console.error("[coinafrique]", e);
      if (p === 1) throw e instanceof Error && e.message.startsWith("CoinAfrique") ? e : new Error("CoinAfrique est injoignable pour le moment. Réessayez plus tard.");
      break;
    }
    const page = parseAds(html).filter((a) => !seen.has(a.id) && seen.add(a.id));
    if (!page.length) break;
    ads.push(...page);
  }
  cache.set(slug, { at: Date.now(), ads });
  return ads;
}

// ---------- Analyse : ce qui revient le plus dans les annonces ----------

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Mots trop generaux pour etre une tendance.
const STOP = new Set(
  (
    "de la le les des et en pour avec au aux du un une sur par sans tout tous toute plus tres bon bonne bons belle beau qualite anti " +
    "produit produits new nouveau nouvelle nouveaux disponible dispo vente vend vendre gros detail prix promo pack lot kit set coffret " +
    "sachet pieces piece taille modele original originale authentique ml cl kg gr litre litres homme femme femmes hommes enfant enfants " +
    "mixte unisexe the and for with paris gamme marque haute grand grande petit petite mini format bamako mali livraison gratuite " +
    "chaussure chaussures paire paires pointure couleur couleurs noir noire blanc blanche"
  ).split(" ")
);

function words(title: string): string[] {
  return [...new Set(norm(title).match(/[a-z0-9]+/g) ?? [])].filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Les mots (produits, marques) les plus presents dans les annonces. */
export function topTerms(ads: LocalAd[], limit = 18): LocalTerm[] {
  const by = new Map<string, number[]>();
  for (const a of ads) for (const w of words(a.title)) by.set(w, [...(by.get(w) ?? []), a.price]);
  // On regroupe singulier/pluriel (parfum/parfums).
  for (const [w, prices] of [...by]) {
    if (w.endsWith("s") && by.has(w.slice(0, -1))) {
      by.set(w.slice(0, -1), [...by.get(w.slice(0, -1))!, ...prices]);
      by.delete(w);
    }
  }
  return [...by.entries()]
    .filter(([, p]) => p.length >= 3)
    .map(([term, p]) => ({ term, count: p.length, medianPrice: median(p.filter((x) => x > 0)) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Annonces qui contiennent tous les mots cherches (les plus recentes d'abord). */
export function filterAds(ads: LocalAd[], q: string): LocalAd[] {
  const ws = norm(q).match(/[a-z0-9]+/g) ?? [];
  const list = ws.length ? ads.filter((a) => ws.every((w) => norm(a.title).includes(w.replace(/s$/, "")))) : ads;
  return [...list].sort((a, b) => a.ageDays - b.ageDays);
}
