import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

const schema = z.object({
  shopName: z.string().min(1).optional(),
  whatsapp: z.string().optional(),
  deliveryFee: z.number().int().nonnegative().optional(),
  partnerAPct: z.number().int().min(0).max(100).optional(),
  adBudget: z.number().int().nonnegative().optional(),
});

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });

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
  const d = { ...parsed.data };
  if (d.whatsapp !== undefined) d.whatsapp = d.whatsapp.replace(/[^\d]/g, ""); // garde les chiffres

  await prisma.setting.upsert({ where: { id: "main" }, update: d, create: { id: "main", ...d } });
  return NextResponse.json({ ok: true });
}
