import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { paymentMode, verifyPayment } from "@/lib/cinetpay";
import { markOrderPaidAndProcess } from "@/lib/orders";

// Confirmation au retour du paiement CinetPay.
// Appelee par la page de suivi avec ?order=<reference>. Verifie le statut reel
// aupres de CinetPay et, si paye, lance le traitement. Idempotent.
// Sert de repli a la notification serveur-a-serveur (notify).
export async function GET(req: Request) {
  const publicId = new URL(req.url).searchParams.get("order");
  if (!publicId) {
    return NextResponse.json({ ok: false, error: "Reference manquante." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { publicId } });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Commande introuvable." }, { status: 404 });
  }

  // Deja traitee (par la notification, ou en simulation) : rien a faire.
  if (order.status !== "PENDING") {
    return NextResponse.json({ ok: true, status: order.status });
  }

  // En simulation, la commande est traitee a la creation : rien a verifier ici.
  if (paymentMode() !== "live") {
    return NextResponse.json({ ok: true, status: order.status });
  }

  const { paid } = await verifyPayment(publicId);
  if (paid) {
    await markOrderPaidAndProcess(publicId);
    return NextResponse.json({ ok: true, status: "PAID" });
  }
  return NextResponse.json({ ok: false, pending: true, error: "Paiement non confirme pour l'instant." }, { status: 202 });
}
