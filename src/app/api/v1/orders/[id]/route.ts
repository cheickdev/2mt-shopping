import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiRequest } from "@/lib/api-auth";

// GET /api/v1/orders/:publicId — statut d'une commande du revendeur.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;
  const { reseller, headers } = auth;

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { publicId: id } });
  if (!order || order.resellerId !== reseller.id) {
    return NextResponse.json({ ok: false, error: "Commande introuvable." }, { status: 404, headers });
  }
  return NextResponse.json(
    {
      ok: true,
      order: {
        publicId: order.publicId,
        service: order.serviceName,
        imei: order.imei,
        status: order.status,
        priceCents: order.priceCents,
        currency: order.currency,
        result: order.resultText,
        errorMessage: order.errorMessage,
        createdAt: order.createdAt,
      },
    },
    { headers },
  );
}
