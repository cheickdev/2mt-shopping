import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CUSTOMER_COOKIE, hashResetToken, hashPassword, sessionValue } from "@/lib/customer-auth";

const schema = z.object({ token: z.string().min(1), password: z.string().min(8, "8 caracteres minimum.") });

// POST /api/account/reset — definit un nouveau mot de passe a partir d'un token valide.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requete invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  }

  const hash = hashResetToken(parsed.data.token);
  const customer = await prisma.customer.findFirst({
    where: { resetTokenHash: hash, resetTokenExpiry: { gt: new Date() } },
  });
  if (!customer) {
    return NextResponse.json({ ok: false, error: "Lien invalide ou expire. Refaites une demande." }, { status: 400 });
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      passwordHash: hashPassword(parsed.data.password),
      resetTokenHash: null,
      resetTokenExpiry: null,
    },
  });

  // On connecte directement le client apres reinitialisation.
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
