import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-auth";
import { safeFetch } from "@/lib/safe-fetch";
import { ebayConfigured, ebayItemId, importFromEbay } from "@/lib/ebay";
import { fromShopifyJson, looksLikeShopify, parseProductPage, type ImportedProduct } from "@/lib/product-import";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({ url: z.string().url("Collez un lien complet (https://…).") });

// Lit une page produit d'un autre site et renvoie ce qu'on a pu en extraire.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });

  // eBay : lecture via l'API officielle (les pages eBay refusent les serveurs).
  const ebayId = ebayItemId(parsed.data.url);
  if (ebayId) {
    if (!ebayConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Pour importer depuis eBay, il faut ajouter les clés gratuites de l'API eBay (EBAY_CLIENT_ID et EBAY_CLIENT_SECRET) dans Vercel. En attendant, ajoutez le produit à la main.",
        },
        { status: 422 }
      );
    }
    try {
      return NextResponse.json({ ok: true, product: await importFromEbay(parsed.data.url, ebayId) });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
    }
  }

  try {
    const page = await safeFetch(parsed.data.url);
    const html = page.body.toString("utf8");

    // Boutiques Shopify : la fiche complete (varietes + photos) est dans /products/xxx.js
    let extra: Partial<ImportedProduct> | undefined;
    const u = new URL(page.url);
    if (looksLikeShopify(html) && /\/products\/[^/]+/.test(u.pathname)) {
      try {
        const js = await safeFetch(`${u.origin}${u.pathname.replace(/\/$/, "")}.js`, { accept: "application/json" });
        extra = fromShopifyJson(JSON.parse(js.body.toString("utf8")), page.url);
      } catch {
        /* pas grave : on garde le reste */
      }
    }

    const product = parseProductPage(html, page.url, extra);
    if (/captcha|robot check|api-services-support@amazon/i.test(html) && !product.name) {
      return NextResponse.json(
        { ok: false, error: "Le site a bloqué la lecture automatique (vérification anti-robot). Réessayez plus tard ou ajoutez le produit à la main." },
        { status: 422 }
      );
    }
    if (!product.name && product.images.length === 0) {
      return NextResponse.json({ ok: false, error: "Aucune information produit trouvée sur cette page." }, { status: 422 });
    }
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    const msg = (e as Error).message || "Lecture impossible.";
    // 401/403/429/503 : le site refuse les lectures automatiques.
    if (/répondu (401|403|429|503)/.test(msg)) {
      return NextResponse.json(
        { ok: false, error: `${msg} Ce site refuse la lecture automatique de ses pages : ajoutez le produit à la main.` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
