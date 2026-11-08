import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, roleForPassword, tokenFor } from "@/lib/admin-auth";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const password = (body as { password?: string })?.password ?? "";
  const role = roleForPassword(password);
  if (!role) {
    return NextResponse.json({ ok: false, error: "Mot de passe incorrect." }, { status: 401 });
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, tokenFor(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true });
}
