import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

const schema = z.object({
  label: z.string().min(1, "Nom de la variété requis.").max(60),
  stock: z.number().int().nonnegative().default(0),
  imageData: z.string().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  const { id } = await params;

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
  if (parsed.data.imageData && parsed.data.imageData.length > 1_800_000) {
    return NextResponse.json({ ok: false, error: "Image trop lourde." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ ok: false, error: "Produit introuvable." }, { status: 404 });

  const count = await prisma.variant.count({ where: { productId: id } });
  const variant = await prisma.variant.create({
    data: {
      productId: id,
      label: parsed.data.label,
      stock: parsed.data.stock ?? 0,
      imageData: parsed.data.imageData ?? null,
      position: count,
    },
  });
  return NextResponse.json({ ok: true, id: variant.id });
}
