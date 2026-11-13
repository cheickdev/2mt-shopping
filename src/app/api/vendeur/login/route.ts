import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { VENDOR_COOKIE, vendorForLogin, vendorToken } from "@/lib/vendors";

// Petit frein contre les essais de mot de passe en serie (par adresse IP).
const tries = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const t = tries.get(ip);
  if (t && t.n >= 8 && t.until > Date.now()) {
    return NextResponse.json({ ok: false, error: "Trop d'essais. Réessayez dans 10 minutes." }, { status: 429 });
  }
  let body: { identifier?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const v = await vendorForLogin(String(body.identifier ?? "").slice(0, 60), String(body.password ?? "").slice(0, 200));
  if (!v) {
    const cur = t && t.until > Date.now() ? t : { n: 0, until: 0 };
    tries.set(ip, { n: cur.n + 1, until: Date.now() + 10 * 60_000 });
    return NextResponse.json({ ok: false, error: "Numéro ou mot de passe incorrect." }, { status: 401 });
  }
  if (!v.active) {
    return NextResponse.json({ ok: false, error: "Votre compte vendeur est suspendu. Contactez 2MT - Shopping." }, { status: 403 });
  }
  tries.delete(ip);
  (await cookies()).set(VENDOR_COOKIE, vendorToken(v.id, v.passHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true });
}
