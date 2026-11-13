import { NextResponse } from "next/server";
import { publicProductWhere } from "@/lib/vendors";
import { prisma } from "@/lib/db";
import { formatFcfa } from "@/lib/money";
import { matchProduct, norm, productHref, queryWords, type Suggestion } from "@/lib/search";

export const dynamic = "force-dynamic";

const MAX = 8;

// Suggestions pendant la saisie : articles, varietes et categories.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const words = queryWords(q);
  if (words.length === 0) return NextResponse.json({ suggestions: [] });

  let products;
  try {
    products = await prisma.product.findMany({
      where: publicProductWhere,
      select: {
        slug: true,
        name: true,
        category: true,
        description: true,
        sizes: true,
        price: true,
        featured: true,
        variants: { where: { active: true }, orderBy: { position: "asc" }, select: { id: true, label: true } },
      },
    });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }

  const ranked = products
    .map((p) => ({ p, m: matchProduct(p, words) }))
    .filter((x): x is { p: (typeof products)[number]; m: NonNullable<ReturnType<typeof matchProduct>> } => !!x.m)
    .sort((a, b) => b.m.score - a.m.score || Number(b.p.featured) - Number(a.p.featured));

  const out: Suggestion[] = [];

  // Categories dont le nom correspond.
  const cats = [...new Set(products.map((p) => p.category))].filter((c) => words.every((w) => norm(c).includes(w)));
  for (const c of cats.slice(0, 2)) {
    out.push({ kind: "category", label: c, detail: "Catégorie", href: `/?cat=${encodeURIComponent(c)}` });
  }

  for (const { p, m } of ranked) {
    if (out.length >= MAX) break;
    const nameHit = words.some((w) => norm(p.name).includes(w));
    // Varietes trouvees : une suggestion par variete (lien direct vers elle).
    for (const v of m.variants.slice(0, 3)) {
      if (out.length >= MAX) break;
      out.push({
        kind: "variant",
        label: `${p.name} — ${v.label}`,
        detail: `${p.category} · ${formatFcfa(p.price)}`,
        href: productHref(p.slug, { variantId: v.id }),
      });
    }
    for (const o of m.options.slice(0, 3)) {
      if (out.length >= MAX) break;
      out.push({
        kind: "variant",
        label: `${p.name} — ${o}`,
        detail: `${p.category} · ${formatFcfa(p.price)}`,
        href: productHref(p.slug, { option: o }),
      });
    }
    // L'article lui-meme (si le nom correspond, ou s'il n'y a pas de variete trouvee).
    if (out.length < MAX && (nameHit || (m.variants.length === 0 && m.options.length === 0))) {
      out.push({
        kind: "product",
        label: p.name,
        detail: `${p.category} · ${formatFcfa(p.price)}`,
        href: productHref(p.slug),
      });
    }
  }

  return NextResponse.json({ suggestions: out.slice(0, MAX) });
}
