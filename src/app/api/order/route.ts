import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder } from "@/lib/orders";
import { currentCustomer } from "@/lib/customer-auth";

const schema = z.object({
  serviceSlug: z.string().min(1),
  imei: z.string().min(1),
  email: z.string().min(1),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps de requete invalide." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Champs manquants." }, { status: 400 });
  }

  // Origine pour construire les URLs de retour du paiement.
  const origin =
    req.headers.get("origin") ?? new URL(req.url).origin;

  // Si un client est connecte, on rattache la commande a son compte.
  const customer = await currentCustomer();

  const result = await createOrder({ ...parsed.data, origin, customerId: customer?.id ?? null });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    publicId: result.publicId,
    checkoutUrl: result.checkoutUrl ?? null,
  });
}
