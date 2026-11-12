import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Comptes de gestion : tresorerie (caisse, Orange Money, banque…) ou preteurs.
const create = z.object({
  name: z.string().trim().min(1, "Donnez un nom au compte.").max(60),
  kind: z.enum(["TRESORERIE", "PRETEUR"]),
  note: z.string().max(200).optional().default(""),
});
const update = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60).optional(),
  note: z.string().max(200).optional(),
  archived: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Compte invalide." }, { status: 400 });
  const exists = await prisma.finAccount.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (exists) return NextResponse.json({ ok: false, error: "Un compte porte déjà ce nom." }, { status: 400 });
  const a = await prisma.finAccount.create({ data: parsed.data });
  return NextResponse.json({ ok: true, id: a.id });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const parsed = update.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Modification invalide." }, { status: 400 });
  const { id, ...data } = parsed.data;
  await prisma.finAccount.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
