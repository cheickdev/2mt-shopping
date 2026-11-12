import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { validateEntry, type AccountKind } from "@/lib/finance";

export const dynamic = "force-dynamic";

// Operations de gestion (achats, depenses, revenus, emprunts, remboursements, transferts).
const entry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  type: z.enum(["REVENU", "ACHAT", "DEPENSE", "EMPRUNT", "REMBOURSEMENT", "TRANSFERT"]),
  amount: z.number().int().positive("Indiquez un montant.").max(10_000_000_000),
  accountId: z.string().min(1),
  toAccountId: z.string().nullable().optional(),
  payee: z.string().max(120).optional().default(""),
  category: z.string().max(60).optional().default(""),
  description: z.string().max(500).optional().default(""),
});

async function who() {
  const role = await currentRole();
  if (!role) return null;
  const s = await getSettings();
  return role === "owner" ? s.ownerName : s.partnerName;
}

export async function POST(req: Request) {
  const by = await who();
  if (!by) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const parsed = entry.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Opération invalide." }, { status: 400 });
  const d = parsed.data;
  const accounts = (await prisma.finAccount.findMany({ select: { id: true, kind: true } })).map((a) => ({ id: a.id, kind: a.kind as AccountKind }));
  const toAccountId = d.toAccountId || null;
  const err = validateEntry({ type: d.type, amount: d.amount, accountId: d.accountId, toAccountId }, accounts);
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });
  const created = await prisma.finEntry.create({
    data: {
      date: new Date(`${d.date}T12:00:00Z`),
      type: d.type,
      amount: d.amount,
      accountId: d.accountId,
      toAccountId,
      payee: d.payee.trim(),
      category: d.category.trim(),
      description: d.description.trim(),
      createdBy: by,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}

export async function DELETE(req: Request) {
  if (!(await who())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  await prisma.finEntry.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
