import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { paymentMode, refundPayment } from "@/lib/stripe";

// Rembourse une commande. Si un paiement Stripe reel est associe, effectue le
// remboursement via Stripe ; sinon (mode simulation) marque simplement REFUNDED.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "Non autorise." }, { status: 401 });
  }
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { publicId: id } });
  if (!order) return NextResponse.json({ ok: false, error: "Commande introuvable." }, { status: 404 });
  if (order.status === "REFUNDED") return NextResponse.json({ ok: true, status: "REFUNDED" });

  if (paymentMode() === "live" && order.stripePaymentIntent) {
    try {
      await refundPayment(order.stripePaymentIntent);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `Remboursement Stripe echoue : ${(err as Error).message}` },
        { status: 400 },
      );
    }
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
  return NextResponse.json({ ok: true, status: "REFUNDED" });
}
