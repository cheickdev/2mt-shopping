import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

const patchSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  stock: z.number().int().nonnegative().optional(),
  imageData: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  }
  if (parsed.data.imageData && parsed.data.imageData.length > 1_800_000) {
    return NextResponse.json({ ok: false, error: "Image trop lourde." }, { status: 400 });
  }

  try {
    await prisma.variant.update({ where: { id }, data: parsed.data });
  } catch {
    return NextResponse.json({ ok: false, error: "Variété introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.variant.delete({ where: { id } });
  } catch {
    return NextResponse.json({ ok: false, error: "Variété introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
