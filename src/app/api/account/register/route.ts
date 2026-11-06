import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CUSTOMER_COOKIE, hashPassword, sessionValue } from "@/lib/customer-auth";
import { sendEmail, welcomeEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "8 caracteres minimum."),
  name: z.string().optional(),
});

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

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "Un compte existe deja avec cet email." }, { status: 409 });
  }

  const customer = await prisma.customer.create({
    data: { email, passwordHash: hashPassword(parsed.data.password), name: parsed.data.name ?? null },
  });

  // Email de bienvenue (non bloquant pour la reponse en cas d'echec d'envoi).
  const welcome = welcomeEmail(customer.name);
  await sendEmail({ ...welcome, to: customer.email });

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
