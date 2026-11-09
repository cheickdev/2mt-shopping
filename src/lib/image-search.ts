// Recherche d'images sur internet a partir du nom d'un produit.
//
// Resultats de Google Images via serper.dev (2 500 recherches offertes a
// l'inscription). Necessite SERPER_API_KEY (Vercel → Environment Variables).
// (Openverse, essaye d'abord sans cle, refuse les requetes des serveurs : 401.)

export interface ImageResult {
  url: string; // image en taille reelle
  thumb: string; // miniature
  title: string;
  source: string; // site d'origine
}

export function imageSearchProvider(): "google" | null {
  return process.env.SERPER_API_KEY ? "google" : null;
}

export const NOT_CONFIGURED =
  "La recherche de photos n'est pas encore activée : créez une clé gratuite sur serper.dev, puis ajoutez-la dans Vercel (variable SERPER_API_KEY) et redéployez.";

async function serper(q: string): Promise<ImageResult[]> {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": process.env.SERPER_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ q, num: 30, gl: "fr", hl: "fr" }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "Clé SERPER_API_KEY refusée." : `Recherche indisponible (${res.status}).`);
  const d = (await res.json()) as {
    images?: { title?: string; imageUrl?: string; thumbnailUrl?: string; domain?: string; source?: string }[];
  };
  return (d.images ?? [])
    .filter((i) => i.imageUrl?.startsWith("http"))
    .map((i) => ({ url: i.imageUrl!, thumb: i.thumbnailUrl || i.imageUrl!, title: i.title ?? "", source: i.domain ?? i.source ?? "" }));
}

export async function searchImages(q: string): Promise<ImageResult[]> {
  let list: ImageResult[];
  try {
    if (!imageSearchProvider()) throw new Error(NOT_CONFIGURED);
    list = await serper(q);
  } catch (e) {
    if (e instanceof TypeError || (e as Error).name === "TimeoutError") {
      throw new Error("Recherche d'images indisponible pour le moment. Réessayez plus tard.");
    }
    throw e;
  }
  const seen = new Set<string>();
  return list.filter((r) => !seen.has(r.url) && seen.add(r.url)).slice(0, 30);
}
