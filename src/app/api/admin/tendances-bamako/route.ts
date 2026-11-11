import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { COINAFRIQUE_CATEGORIES, fetchCategory, filterAds, topTerms } from "@/lib/coinafrique";

export const dynamic = "force-dynamic";

// Tendances a Bamako (annonces CoinAfrique Mali), reserve aux administrateurs.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const cat = sp.get("cat") || COINAFRIQUE_CATEGORIES[0].slug;
  const q = (sp.get("q") ?? "").trim().slice(0, 80);
  try {
    const ads = await fetchCategory(cat);
    const found = filterAds(ads, q);
    return NextResponse.json({
      ok: true,
      total: ads.length,
      oldestDays: ads.reduce((m, a) => Math.max(m, a.ageDays === 999 ? 0 : a.ageDays), 0),
      terms: topTerms(q ? found : ads),
      count: found.length,
      results: found.slice(0, 60),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Recherche impossible." }, { status: 502 });
  }
}
