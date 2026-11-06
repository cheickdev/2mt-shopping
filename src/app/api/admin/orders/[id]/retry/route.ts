import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { processOrder } from "@/lib/orders";

// Relance le traitement fournisseur d'une commande (ex. apres un echec).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "Non autorise." }, { status: 401 });
  }
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { publicId: id } });
  if (!order) return NextResponse.json({ ok: false, error: "Commande introuvable." }, { status: 404 });

  await processOrder(id);
  const updated = await prisma.order.findUnique({ where: { publicId: id } });
  return NextResponse.json({ ok: true, status: updated?.status });
}
