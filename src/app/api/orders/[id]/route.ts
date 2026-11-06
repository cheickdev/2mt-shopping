import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/orders/:publicId  -> statut et resultat d'une commande.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { publicId: id } });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Commande introuvable." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    order: {
      publicId: order.publicId,
      serviceName: order.serviceName,
      imei: order.imei,
      status: order.status,
      resultText: order.resultText,
      errorMessage: order.errorMessage,
      createdAt: order.createdAt,
    },
  });
}
