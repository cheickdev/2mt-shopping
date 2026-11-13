import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/admin-auth";
import { currentVendor, publicProductWhere } from "@/lib/vendors";
import { VISITOR_COOKIE, isBot, isMobile, recordVisit, sourceOf } from "@/lib/visits";

export const dynamic = "force-dynamic";

// Compte une page vue. Appele par le navigateur du visiteur a chaque page.
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua)) return NextResponse.json({ ok: true });
  // Vos propres visites (admin, partenaire, vendeurs) ne sont pas comptees.
  if ((await currentRole()) || (await currentVendor())) return NextResponse.json({ ok: true });

  let body: { path?: string; search?: string; ref?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const path = String(body.path ?? "/").slice(0, 200);
  if (/^\/(admin|api|vendeur\/espace|vendeur\/connexion)/.test(path)) return NextResponse.json({ ok: true });

  const store = await cookies();
  let visitor = store.get(VISITOR_COOKIE)?.value ?? "";
  if (!/^[a-f0-9]{24}$/.test(visitor)) {
    visitor = crypto.randomBytes(12).toString("hex");
    store.set(VISITOR_COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  let productId: string | null = null;
  const m = path.match(/^\/produit\/([^/?#]+)/);
  if (m) {
    const p = await prisma.product
      .findFirst({ where: { ...publicProductWhere, slug: decodeURIComponent(m[1]) }, select: { id: true } })
      .catch(() => null);
    productId = p?.id ?? null;
  }

  const host = new URL(req.url).hostname;
  try {
    await recordVisit({
      visitor,
      source: sourceOf(String(body.ref ?? "").slice(0, 300), String(body.search ?? "").slice(0, 300), host),
      mobile: isMobile(ua),
      productId,
    });
  } catch {
    // Les statistiques ne doivent jamais gener le site.
  }
  return NextResponse.json({ ok: true });
}
