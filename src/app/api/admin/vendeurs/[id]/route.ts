import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOwner } from "@/lib/admin-auth";
import { hashVendorPassword, normalizeWhatsapp } from "@/lib/vendors";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  whatsapp: z.string().min(8).optional(),
  description: z.string().max(400).optional(),
  password: z.string().min(6, "Mot de passe : 6 caractères minimum.").optional(),
  maxProducts: z.number().int().min(1).max(500).optional(),
  freeUntil: z.string().nullable().optional(),
  active: z.boolean().optional(), // false = suspendu : tous ses produits disparaissent du site
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isOwner())) return NextResponse.json({ ok: false, error: "Réservé au propriétaire." }, { status: 403 });
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  const d = parsed.data;
  const whatsapp = d.whatsapp ? normalizeWhatsapp(d.whatsapp) : undefined;
  if (whatsapp && (await prisma.vendor.findFirst({ where: { whatsapp, id: { not: id } } }))) {
    return NextResponse.json({ ok: false, error: "Un autre vendeur a déjà ce numéro." }, { status: 400 });
  }
  await prisma.vendor.update({
    where: { id },
    data: {
      name: d.name,
      whatsapp,
      description: d.description,
      maxProducts: d.maxProducts,
      active: d.active,
      ...(d.freeUntil !== undefined ? { freeUntil: d.freeUntil ? new Date(d.freeUntil) : null } : {}),
      // Nouveau mot de passe : deconnecte aussi le vendeur partout.
      ...(d.password ? { passHash: hashVendorPassword(d.password) } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
