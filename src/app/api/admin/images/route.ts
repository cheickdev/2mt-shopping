import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { currentVendor } from "@/lib/vendors";
import { imageSearchProvider, searchImages } from "@/lib/image-search";

export const dynamic = "force-dynamic";

// Recherche d'images par nom de produit (reserve aux administrateurs).
export async function GET(req: Request) {
  if (!(await isAdmin()) && !(await currentVendor())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return NextResponse.json({ ok: false, error: "Tapez le nom du produit." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, provider: imageSearchProvider(), results: await searchImages(q) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Recherche impossible." }, { status: 502 });
  }
}
