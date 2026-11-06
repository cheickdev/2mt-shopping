import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "slug : minuscules, chiffres et tirets."),
  name: z.string().min(1),
  type: z.enum(["CHECK", "UNLOCK"]),
  category: z.string().min(1),
  description: z.string().default(""),
  priceCents: z.number().int().nonnegative(),
  costCents: z.number().int().nonnegative(),
  estimatedTime: z.string().default("Instantane"),
  dhruServiceId: z.string().nullable().optional(),
  active: z.boolean().default(true),
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  }

  const existing = await prisma.service.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "Ce slug existe deja." }, { status: 409 });
  }

  const service = await prisma.service.create({
    data: { ...parsed.data, dhruServiceId: parsed.data.dhruServiceId ?? null, currency: "EUR" },
  });
  return NextResponse.json({ ok: true, service });
}
