import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { findTrends } from "@/lib/trends";

export const dynamic = "force-dynamic";

// Produits en tendance pour un theme (reserve aux administrateurs).
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ ok: false, error: "Tapez un thème (ex. parfum homme)." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await findTrends(q)) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Recherche impossible." }, { status: 502 });
  }
}
