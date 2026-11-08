import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

const schema = z.object({
  status: z.enum(["NOUVELLE", "CONFIRMEE", "EN_LIVRAISON", "LIVREE", "ANNULEE"]),
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Statut invalide." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { publicId: id }, include: { items: true } });
  if (!order) return NextResponse.json({ ok: false, error: "Commande introuvable." }, { status: 404 });

  const newStatus = parsed.data.status;

  // Si on annule une commande non encore annulee, on remet le stock.
  if (newStatus === "ANNULEE" && order.status !== "ANNULEE") {
    await prisma.$transaction(async (tx) => {
      for (const it of order.items) {
        if (it.productId) await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
      }
      await tx.order.update({ where: { id: order.id }, data: { status: newStatus } });
    });
  } else {
    await prisma.order.update({ where: { id: order.id }, data: { status: newStatus } });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
