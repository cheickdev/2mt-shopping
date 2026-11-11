import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOwner, hashPassword } from "@/lib/admin-auth";

const schema = z.object({
  shopName: z.string().min(1).optional(),
  whatsapp: z.string().optional(),
  deliveryFee: z.number().int().nonnegative().optional(),
  partnerAPct: z.number().int().min(0).max(100).optional(),
  adBudget: z.number().int().nonnegative().optional(),
  metaPixelId: z.string().regex(/^\d{0,20}$/, "L'ID du Pixel ne contient que des chiffres.").optional(),
  ownerName: z.string().min(1).max(40).optional(),
  partnerName: z.string().min(1).max(40).optional(),
  // Point de depart des livraisons (null = non regle).
  shopLat: z.number().min(-90).max(90).nullable().optional(),
  shopLng: z.number().min(-180).max(180).nullable().optional(),
  // Nouveaux mots de passe (facultatifs) : vides = inchanges.
  ownerPassword: z.string().min(4, "Mot de passe trop court (4 min).").optional(),
  partnerPassword: z.string().min(4, "Mot de passe trop court (4 min).").optional(),
});

export async function PATCH(req: Request) {
  if (!(await isOwner())) return NextResponse.json({ ok: false, error: "Réservé au propriétaire." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  }

  const { ownerPassword, partnerPassword, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  // Les deux coordonnees vont ensemble.
  if ((data.shopLat == null) !== (data.shopLng == null)) {
    data.shopLat = null;
    data.shopLng = null;
  }
  if (data.whatsapp !== undefined) data.whatsapp = String(data.whatsapp).replace(/[^\d]/g, "");
  if (ownerPassword && ownerPassword.trim()) data.ownerPassHash = hashPassword(ownerPassword.trim());
  if (partnerPassword && partnerPassword.trim()) data.partnerPassHash = hashPassword(partnerPassword.trim());

  await prisma.setting.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });
  return NextResponse.json({ ok: true, passwordChanged: !!(ownerPassword || partnerPassword) });
}
