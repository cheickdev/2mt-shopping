import { NextResponse } from "next/server";
import { RESELLER_COOKIE, resellerFromApiKey, sessionValue } from "@/lib/reseller-auth";

// Connexion au tableau de bord revendeur avec la cle API.
export async function POST(req: Request) {
  let body: { apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requete invalide." }, { status: 400 });
  }

  const reseller = await resellerFromApiKey((body.apiKey ?? "").trim());
  if (!reseller) {
    return NextResponse.json({ ok: false, error: "Cle API invalide ou compte inactif." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(RESELLER_COOKIE, sessionValue(reseller.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
