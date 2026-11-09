// Import depuis eBay via l'API officielle « Browse » (gratuite, compte
// developpeur eBay). eBay refuse la lecture directe de ses pages par un serveur ;
// l'API, elle, est faite pour ca.
//
// Configuration (Vercel → Settings → Environment Variables) :
//   EBAY_CLIENT_ID     = App ID (Client ID) de votre application eBay (Production)
//   EBAY_CLIENT_SECRET = Cert ID (Client Secret)
//   EBAY_MARKETPLACE   = optionnel, ex. EBAY_US (defaut), EBAY_FR, EBAY_GB…

import type { ImportedProduct, ImportedVariant } from "@/lib/product-import";

const API = "https://api.ebay.com";

export function ebayConfigured(): boolean {
  return !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

/** Numero d'annonce eBay dans un lien (ex. https://www.ebay.com/itm/263120520131), sinon null. */
export function ebayItemId(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!/(^|\.)ebay\.[a-z.]+$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/) ?? u.search.match(/[?&]item=(\d{9,15})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

let cached: { token: string; until: number } | null = null;

async function appToken(): Promise<string> {
  if (cached && Date.now() < cached.until) return cached.token;
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
  });
  if (!res.ok) throw new Error("Clés eBay refusées : vérifiez EBAY_CLIENT_ID et EBAY_CLIENT_SECRET.");
  const d = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: d.access_token, until: Date.now() + (d.expires_in - 120) * 1000 };
  return d.access_token;
}

// --- Forme (simplifiee) des reponses de l'API Browse ---
export interface EbayItem {
  title?: string;
  shortDescription?: string;
  description?: string;
  image?: { imageUrl?: string };
  additionalImages?: { imageUrl?: string }[];
  price?: { value?: string; currency?: string };
  localizedAspects?: { name: string; value: string }[];
}
interface EbayError {
  errors?: { errorId: number; message?: string }[];
}

async function call<T>(path: string): Promise<{ status: number; data: T & EbayError }> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${await appToken()}`,
      "X-EBAY-C-MARKETPLACE-ID": process.env.EBAY_MARKETPLACE || "EBAY_US",
      "Accept-Language": "fr-FR",
    },
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T & EbayError };
}

const stripHtml = (s: string) =>
  s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();

const imagesOf = (it: EbayItem) =>
  [it.image?.imageUrl, ...(it.additionalImages ?? []).map((x) => x.imageUrl)].filter((x): x is string => !!x);

/** Transforme une annonce simple, ou un groupe de varietes, en produit importable. */
export function mapEbay(url: string, items: EbayItem[], groupTitle?: string): ImportedProduct {
  const first = items[0] ?? {};
  // Varietes : les caracteristiques qui changent d'une variete a l'autre (couleur, taille…).
  const variants: ImportedVariant[] = [];
  if (items.length > 1) {
    const names = new Set(items.flatMap((i) => (i.localizedAspects ?? []).map((a) => a.name)));
    const varying = [...names].filter(
      (n) => new Set(items.map((i) => i.localizedAspects?.find((a) => a.name === n)?.value ?? "")).size > 1
    );
    for (const it of items) {
      const label = varying
        .map((n) => it.localizedAspects?.find((a) => a.name === n)?.value)
        .filter(Boolean)
        .join(" - ")
        .slice(0, 60);
      if (label) variants.push({ label, image: it.image?.imageUrl ?? null });
    }
  }
  const images = [...new Set(items.flatMap(imagesOf))].slice(0, 12);
  const desc = first.description ? stripHtml(first.description) : first.shortDescription ?? "";
  const price = first.price?.value ? parseFloat(first.price.value) : null;
  return {
    source: "ebay (API officielle)",
    url,
    name: (groupTitle ?? first.title ?? "").trim(),
    description: desc.slice(0, 4000),
    images,
    price: Number.isFinite(price) ? price : null,
    currency: first.price?.currency ?? null,
    variants,
  };
}

export async function importFromEbay(url: string, itemId: string): Promise<ImportedProduct> {
  const single = await call<EbayItem>(`/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${itemId}`);
  if (single.status === 200 && single.data.title) return mapEbay(url, [single.data]);

  // Annonce avec varietes : eBay demande de lire le « groupe ».
  const group = await call<{ items?: EbayItem[]; commonDescriptions?: { description?: string }[] }>(
    `/buy/browse/v1/item/get_items_by_item_group?item_group_id=${itemId}`
  );
  if (group.status === 200 && group.data.items?.length) {
    const items = group.data.items;
    const common = group.data.commonDescriptions?.[0]?.description;
    if (common && !items[0].description) items[0] = { ...items[0], description: common };
    return mapEbay(url, items);
  }
  const msg = single.data.errors?.[0]?.message ?? group.data.errors?.[0]?.message;
  throw new Error(msg ? `eBay : ${msg}` : "Annonce eBay introuvable (terminée ou retirée ?).");
}
