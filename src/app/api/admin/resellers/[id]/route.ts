import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { topupWallet } from "@/lib/orders";

const schema = z.object({
  resellerMarginPercent: z.number().int().min(0).max(500).optional(),
  rateLimitPerMin: z.number().int().min(1).max(100000).optional(),
  active: z.boolean().optional(),
  adjustCents: z.number().int().optional(), // credite (>0) ou debite (<0) le portefeuille
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "Non autorise." }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requete invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Champs invalides." }, { status: 400 });
  }

  const reseller = await prisma.reseller.findUnique({ where: { id } });
  if (!reseller) return NextResponse.json({ ok: false, error: "Revendeur introuvable." }, { status: 404 });

  const data: { resellerMarginPercent?: number; rateLimitPerMin?: number; active?: boolean } = {};
  if (parsed.data.resellerMarginPercent !== undefined) data.resellerMarginPercent = parsed.data.resellerMarginPercent;
  if (parsed.data.rateLimitPerMin !== undefined) data.rateLimitPerMin = parsed.data.rateLimitPerMin;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (Object.keys(data).length > 0) {
    await prisma.reseller.update({ where: { id }, data });
  }

  let balanceCents = reseller.balanceCents;
  if (parsed.data.adjustCents) {
    balanceCents = await topupWallet(id, parsed.data.adjustCents, "ADJUST", "Ajustement admin");
  }

  return NextResponse.json({ ok: true, balanceCents });
}
