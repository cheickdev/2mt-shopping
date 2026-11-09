import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-auth";
import { safeFetch } from "@/lib/safe-fetch";
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
    return NextResponse.json({ ok: false, error: (e as Error).message || "Lecture impossible." }, { status: 502 });
  }
}
