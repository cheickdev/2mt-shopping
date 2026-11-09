// Recherche d'images sur internet a partir du nom d'un produit.
//
// - Avec SERPER_API_KEY (Vercel → Environment Variables) : resultats de Google
//   Images via serper.dev (2 500 recherches offertes a l'inscription).
// - Sans cle : Openverse (gratuit, sans compte), des images sous licence libre ;
//   moins de photos de produits de marque.

export interface ImageResult {
  url: string; // image en taille reelle
  thumb: string; // miniature
  title: string;
  source: string; // site d'origine
}

export function imageSearchProvider(): "google" | "openverse" {
  return process.env.SERPER_API_KEY ? "google" : "openverse";
}

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

async function openverse(q: string): Promise<ImageResult[]> {
  const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=24&mature=false`, {
    headers: { "User-Agent": "2MT-Shopping/1.0 (boutique en ligne)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Recherche indisponible (${res.status}).`);
  const d = (await res.json()) as {
    results?: { url?: string; thumbnail?: string; title?: string; source?: string; foreign_landing_url?: string }[];
  };
  return (d.results ?? [])
    .filter((i) => i.url?.startsWith("http"))
    .map((i) => ({ url: i.url!, thumb: i.thumbnail || i.url!, title: i.title ?? "", source: i.source ?? "" }));
}

export async function searchImages(q: string): Promise<ImageResult[]> {
  let list: ImageResult[];
  try {
    list = imageSearchProvider() === "google" ? await serper(q) : await openverse(q);
  } catch (e) {
    if (e instanceof TypeError || (e as Error).name === "TimeoutError") {
      throw new Error("Recherche d'images indisponible pour le moment. Réessayez plus tard.");
    }
    throw e;
  }
  const seen = new Set<string>();
  return list.filter((r) => !seen.has(r.url) && seen.add(r.url)).slice(0, 30);
}
