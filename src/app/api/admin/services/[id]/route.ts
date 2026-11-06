import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(["CHECK", "UNLOCK"]).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  costCents: z.number().int().nonnegative().optional(),
  estimatedTime: z.string().min(1).optional(),
  dhruServiceId: z.string().nullable().optional(),
  active: z.boolean().optional(),
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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  }

  try {
    const service = await prisma.service.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ ok: true, service });
  } catch {
    return NextResponse.json({ ok: false, error: "Service introuvable." }, { status: 404 });
  }
}
