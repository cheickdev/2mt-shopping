import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { generateApiKey } from "@/lib/reseller-auth";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  resellerMarginPercent: z.number().int().min(0).max(500).default(30),
  initialBalanceCents: z.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "Non autorise." }, { status: 401 });
  }

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

  const existing = await prisma.reseller.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "Un revendeur avec cet email existe deja." }, { status: 409 });
  }

  const apiKey = generateApiKey();
  const reseller = await prisma.reseller.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      apiKey,
      resellerMarginPercent: parsed.data.resellerMarginPercent,
      balanceCents: parsed.data.initialBalanceCents,
    },
  });

  // On renvoie la cle en clair UNE SEULE FOIS, a communiquer au revendeur.
  return NextResponse.json({ ok: true, reseller: { id: reseller.id, name: reseller.name, apiKey } });
}
