import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CUSTOMER_COOKIE, verifyPassword, sessionValue } from "@/lib/customer-auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requete invalide." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Email ou mot de passe manquant." }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Message identique que l'email existe ou non (evite l'enumeration de comptes).
  if (!customer || !verifyPassword(parsed.data.password, customer.passwordHash)) {
    return NextResponse.json({ ok: false, error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE, sessionValue(customer.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
