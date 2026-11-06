import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

// Marque une commande comme remboursee.
// Note : CinetPay n'offre pas d'API de remboursement simple (contrairement a
// Stripe) ; le remboursement effectif (Mobile Money/carte) se fait cote CinetPay
// ou aupres du client. Ici on enregistre le statut REFUNDED.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "Non autorise." }, { status: 401 });
  }
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { publicId: id } });
  if (!order) return NextResponse.json({ ok: false, error: "Commande introuvable." }, { status: 404 });
  if (order.status === "REFUNDED") return NextResponse.json({ ok: true, status: "REFUNDED" });

  await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
  return NextResponse.json({ ok: true, status: "REFUNDED" });
}
