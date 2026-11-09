// Lecture d'une page produit d'un autre site (Amazon, boutiques Shopify, et
// tout site qui decrit ses produits en donnees structurees schema.org /
// Open Graph) pour en extraire : nom, description, images, prix, varietes.
// Fonctions pures (pas de reseau ici) : testables sur du HTML enregistre.

export interface ImportedVariant {
  label: string;
  image: string | null;
}

export interface ImportedProduct {
  source: string; // nom du site
  url: string;
  name: string;
  description: string;
  images: string[];
  price: number | null; // prix sur le site d'origine (information seulement)
  currency: string | null;
  variants: ImportedVariant[];
}

const MAX_IMAGES = 12;
const MAX_VARIANTS = 40;

// ---------- utilitaires ----------
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z#0-9]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function clean(s: unknown, max = 4000): string {
  if (typeof s !== "string") return "";
  return decodeEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, max);
}

function absolute(u: string, base: string): string | null {
  try {
    const url = new URL(decodeEntities(u.trim()), base);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    /* ignore */
  }
  return null;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function metaAll(html: string, key: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[:.]/g, "\\$&")}["'][^>]*>`, "gi");
  for (const tag of html.match(re) ?? []) {
    const m = tag.match(/content=["']([^"']*)["']/i);
    if (m) out.push(decodeEntities(m[1]));
  }
  // attribut content avant property
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key.replace(/[:.]/g, "\\$&")}["']`, "gi");
  let m2;
  while ((m2 = re2.exec(html))) out.push(decodeEntities(m2[1]));
  return out;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ---------- JSON-LD (schema.org) ----------
type Json = Record<string, unknown>;

function jsonLdBlocks(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const stack: unknown[] = [data];
      while (stack.length) {
        const x = stack.pop();
        if (Array.isArray(x)) stack.push(...x);
        else if (x && typeof x === "object") {
          out.push(x as Json);
          const g = (x as Json)["@graph"];
          if (g) stack.push(g);
        }
      }
    } catch {
      /* JSON invalide : ignore */
    }
  }
  return out;
}

const isType = (o: Json, t: string) => {
  const ty = o["@type"];
  return ty === t || (Array.isArray(ty) && ty.includes(t));
};

function ldImages(v: unknown, base: string): string[] {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? ((x as Json).url ?? (x as Json).contentUrl) : null))
    .filter((x): x is string => typeof x === "string")
    .map((u) => absolute(u, base))
    .filter((x): x is string => !!x);
}

function ldOffer(o: Json): { price: number | null; currency: string | null } {
  const offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
  if (!offers || typeof offers !== "object") return { price: null, currency: null };
  const of = offers as Json;
  const price = toNumber(of.price ?? of.lowPrice ?? (of.priceSpecification as Json | undefined)?.price);
  const currency = typeof of.priceCurrency === "string" ? of.priceCurrency : null;
  return { price, currency };
}

function variantLabel(v: Json, parentName: string): string {
  const parts = [v.color, v.size, v.material, v.pattern].filter((x): x is string => typeof x === "string" && !!x.trim());
  if (parts.length) return clean(parts.join(" - "), 60);
  let name = clean(v.name, 120);
  // « Deodorant Axe - Africa 150ml » -> « Africa 150ml »
  if (parentName && name.toLowerCase().startsWith(parentName.toLowerCase())) {
    name = name.slice(parentName.length).replace(/^[\s\-–—:,|]+/, "");
  }
  return name.slice(0, 60);
}

function fromJsonLd(html: string, base: string): Partial<ImportedProduct> | null {
  const blocks = jsonLdBlocks(html);
  const group = blocks.find((b) => isType(b, "ProductGroup"));
  const product = group ?? blocks.find((b) => isType(b, "Product"));
  if (!product) return null;
  const name = clean(product.name, 200);
  const variants: ImportedVariant[] = [];
  const images = ldImages(product.image, base);
  let { price, currency } = ldOffer(product);
  const hv = product.hasVariant;
  for (const v of (Array.isArray(hv) ? hv : []) as Json[]) {
    if (!v || typeof v !== "object") continue;
    const label = variantLabel(v, name);
    const vImgs = ldImages(v.image, base);
    if (label) variants.push({ label, image: vImgs[0] ?? null });
    images.push(...vImgs);
    if (price == null) ({ price, currency } = ldOffer(v));
  }
  return { name, description: clean(product.description), images, price, currency, variants };
}

// ---------- Amazon ----------
function fromAmazon(html: string, base: string): Partial<ImportedProduct> {
  const title = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
  const name = title ? clean(title[1], 200) : "";

  // Points cles « A propos de cet article »
  const bullets: string[] = [];
  const fb = html.match(/id=["']feature-bullets["'][\s\S]*?<\/ul>/i);
  if (fb) {
    for (const li of fb[0].match(/<span class=["']a-list-item["'][^>]*>([\s\S]*?)<\/span>/gi) ?? []) {
      const t = clean(li, 400);
      if (t) bullets.push("• " + t);
    }
  }
  const descBlock = html.match(/id=["']productDescription["'][^>]*>([\s\S]*?)<\/div>/i);
  const description = [bullets.join("\n"), descBlock ? clean(descBlock[1]) : ""].filter(Boolean).join("\n\n");

  // Images haute definition
  const images = uniq(
    [...html.matchAll(/"hiRes"\s*:\s*"(https:[^"]+)"/g), ...html.matchAll(/"large"\s*:\s*"(https:[^"]+)"/g)].map((m) =>
      m[1].replace(/\\\//g, "/")
    )
  )
    .map((u) => absolute(u, base))
    .filter((x): x is string => !!x);
  const landing = html.match(/id=["']landingImage["'][^>]*data-old-hires=["']([^"']+)["']/i);
  if (landing) {
    const u = absolute(landing[1], base);
    if (u) images.unshift(u);
  }

  // Varietes (taille, parfum, couleur…)
  const variants: ImportedVariant[] = [];
  const dv = html.match(/"dimensionValuesDisplayData"\s*:\s*(\{[\s\S]*?\})\s*,\s*"/);
  if (dv) {
    try {
      const data = JSON.parse(dv[1]) as Record<string, string[]>;
      for (const vals of Object.values(data)) {
        const label = clean(vals.join(" - "), 60);
        if (label) variants.push({ label, image: null });
      }
    } catch {
      /* ignore */
    }
  }
  if (variants.length === 0) {
    const vv = html.match(/"variationValues"\s*:\s*(\{[\s\S]*?\})\s*,\s*"/);
    if (vv) {
      try {
        const data = JSON.parse(vv[1]) as Record<string, string[]>;
        const dims = Object.values(data).filter((a) => Array.isArray(a) && a.length);
        if (dims.length === 1) for (const v of dims[0]) variants.push({ label: clean(v, 60), image: null });
        else if (dims.length >= 2)
          for (const a of dims[0]) for (const b of dims[1]) variants.push({ label: clean(`${a} - ${b}`, 60), image: null });
      } catch {
        /* ignore */
      }
    }
  }

  // Prix
  const pw = html.match(/class=["']a-price-whole["'][^>]*>([\d\s.,]+)/i);
  const pf = html.match(/class=["']a-price-fraction["'][^>]*>(\d+)/i);
  const price = pw ? toNumber(pw[1].replace(/[.,\s]/g, "") + (pf ? "." + pf[1] : "")) : null;
  const sym = html.match(/class=["']a-price-symbol["'][^>]*>([^<]+)/i);
  const currency = sym ? ({ "€": "EUR", $: "USD", "£": "GBP" } as Record<string, string>)[sym[1].trim()] ?? sym[1].trim() : null;

  return { name, description, images, price, currency, variants };
}

// ---------- Shopify (/products/xxx.js) ----------
export interface ShopifyProductJson {
  title?: string;
  description?: string;
  images?: string[];
  price?: number; // en centimes
  variants?: { title?: string; featured_image?: { src?: string } | null }[];
}

export function fromShopifyJson(data: ShopifyProductJson, base: string): Partial<ImportedProduct> {
  const images = (data.images ?? []).map((u) => absolute(u.startsWith("//") ? "https:" + u : u, base)).filter((x): x is string => !!x);
  const variants = (data.variants ?? [])
    .filter((v) => v.title && v.title !== "Default Title")
    .map((v) => ({
      label: clean(v.title, 60),
      image: v.featured_image?.src ? absolute(v.featured_image.src.startsWith("//") ? "https:" + v.featured_image.src : v.featured_image.src, base) : null,
    }));
  return {
    name: clean(data.title, 200),
    description: clean(data.description),
    images,
    price: typeof data.price === "number" ? data.price / 100 : null,
    variants,
  };
}

export function looksLikeShopify(html: string): boolean {
  return /cdn\.shopify\.com|Shopify\.theme|shopify-section/i.test(html);
}

// ---------- assemblage ----------
export function isAmazon(url: string): boolean {
  try {
    return /(^|\.)amazon\.[a-z.]+$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Analyse le HTML d'une page produit. `extra` = donnees deja extraites (ex. Shopify). */
export function parseProductPage(html: string, url: string, extra?: Partial<ImportedProduct>): ImportedProduct {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();
  const amazon = isAmazon(url) ? fromAmazon(html, url) : null;
  const ld = fromJsonLd(html, url);
  const ogTitle = metaAll(html, "og:title")[0] ?? "";
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogImages = [...metaAll(html, "og:image"), ...metaAll(html, "og:image:secure_url"), ...metaAll(html, "twitter:image")]
    .map((u) => absolute(u, url))
    .filter((x): x is string => !!x);
  const ogPrice = toNumber(metaAll(html, "product:price:amount")[0] ?? metaAll(html, "og:price:amount")[0]);
  const ogCurrency = metaAll(html, "product:price:currency")[0] ?? metaAll(html, "og:price:currency")[0] ?? null;

  const pick = <K extends keyof ImportedProduct>(k: K): ImportedProduct[K] | undefined => {
    for (const src of [extra, amazon, ld]) {
      const v = src?.[k];
      if (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "") return v as ImportedProduct[K];
    }
    return undefined;
  };

  const name = pick("name") ?? clean(ogTitle || (titleTag ? titleTag[1] : ""), 200);
  const description = pick("description") ?? clean(metaAll(html, "og:description")[0] ?? metaAll(html, "description")[0] ?? "");
  const images = uniq([...(extra?.images ?? []), ...(amazon?.images ?? []), ...(ld?.images ?? []), ...ogImages])
    .filter((u) => !/sprite|logo|icon|pixel|transparent|grey-pixel|\.gif(\?|$)|\.svg(\?|$)/i.test(u))
    .slice(0, MAX_IMAGES);

  // Varietes : sans doublons de nom.
  const seen = new Set<string>();
  const variants = (pick("variants") ?? [])
    .filter((v) => v.label && !seen.has(v.label.toLowerCase()) && seen.add(v.label.toLowerCase()))
    .slice(0, MAX_VARIANTS);

  return {
    source: host,
    url,
    name,
    description,
    images,
    price: pick("price") ?? ogPrice,
    currency: pick("currency") ?? ogCurrency,
    variants,
  };
}
