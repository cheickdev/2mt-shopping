// Produits en tendance : Google Shopping (via serper.dev, meme cle que la
// recherche de photos : SERPER_API_KEY) + recherches populaires (autocomplete).
// Les produits sont classes par popularite : nombre d'avis x note.

import { NOT_CONFIGURED } from "@/lib/image-search";

export interface TrendItem {
  title: string;
  imageUrl: string;
  price: string; // tel qu'affiche (ex. "12,99 €")
  priceFcfa: number | null; // conversion indicative
  source: string;
  link: string;
  rating: number | null;
  ratingCount: number | null;
  score: number; // popularite
}

const EUR_FCFA = 655.957; // taux fixe euro / franc CFA
const USD_FCFA = 600; // indicatif

// Permet de pointer vers un faux serveur pendant les tests.
const BASE = process.env.SERPER_ENDPOINT || "https://google.serper.dev";

async function serper<T>(path: string, body: object): Promise<T> {
  if (!process.env.SERPER_API_KEY) throw new Error(NOT_CONFIGURED);
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, {
      method: "POST",
      headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ gl: "fr", hl: "fr", ...body }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Recherche des tendances indisponible pour le moment. Réessayez plus tard.");
  }
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "Clé SERPER_API_KEY refusée." : `Recherche indisponible (${res.status}).`);
  return (await res.json()) as T;
}

/** "12,99 €" -> 8 521 ; "$15.00" -> 9 000 ; "15 000 FCFA" -> 15 000 */
export function toFcfa(price: string): number | null {
  const m = price.replace(/ /g, " ").match(/(\d[\d\s.,]*)/);
  if (!m) return null;
  let n = m[1].replace(/\s/g, "");
  // 1.234,56 ou 1,234.56 : le dernier separateur est la virgule decimale
  if (/,\d{1,2}$/.test(n)) n = n.replace(/\./g, "").replace(",", ".");
  else n = n.replace(/,/g, "");
  const v = parseFloat(n);
  if (!Number.isFinite(v)) return null;
  if (/€|eur/i.test(price)) return Math.round((v * EUR_FCFA) / 50) * 50;
  if (/\$|usd/i.test(price)) return Math.round((v * USD_FCFA) / 50) * 50;
  if (/f\s?cfa|xof|\bf\b/i.test(price)) return Math.round(v);
  return null;
}

type ShoppingResp = {
  shopping?: { title?: string; imageUrl?: string; price?: string; source?: string; link?: string; rating?: number; ratingCount?: number }[];
};
type AutoResp = { suggestions?: { value?: string }[] };

export async function findTrends(q: string): Promise<{ results: TrendItem[]; suggestions: string[] }> {
  const [shop, auto] = await Promise.all([
    serper<ShoppingResp>("shopping", { q, num: 40 }),
    serper<AutoResp>("autocomplete", { q }).catch(() => ({}) as AutoResp),
  ]);
  const seen = new Set<string>();
  const results = (shop.shopping ?? [])
    .filter((s) => s.title && s.imageUrl?.startsWith("http"))
    .map((s): TrendItem => {
      const rating = typeof s.rating === "number" ? s.rating : null;
      const ratingCount = typeof s.ratingCount === "number" ? s.ratingCount : null;
      return {
        title: s.title!.slice(0, 200),
        imageUrl: s.imageUrl!,
        price: s.price ?? "",
        priceFcfa: s.price ? toFcfa(s.price) : null,
        source: s.source ?? "",
        link: s.link?.startsWith("http") ? s.link : "",
        rating,
        ratingCount,
        // Popularite : beaucoup d'avis ET bonne note (les produits sans avis restent apres).
        score: (ratingCount ? Math.log10(ratingCount + 1) : 0) * (rating ?? 3),
      };
    })
    .filter((r) => {
      const k = r.title.toLowerCase();
      return !seen.has(k) && seen.add(k);
    })
    .sort((a, b) => b.score - a.score);
  const suggestions = (auto.suggestions ?? [])
    .map((s) => (s.value ?? "").trim())
    .filter((s) => s && s.toLowerCase() !== q.toLowerCase())
    .slice(0, 8);
  return { results, suggestions };
}
