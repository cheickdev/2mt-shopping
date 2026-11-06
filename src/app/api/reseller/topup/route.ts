import { NextResponse } from "next/server";
import { z } from "zod";
import { currentReseller } from "@/lib/reseller-auth";
import { paymentMode, createTopupSession } from "@/lib/stripe";
import { topupWallet } from "@/lib/orders";

const schema = z.object({ amountCents: z.number().int().positive().max(1_000_000) });

// Recharge le portefeuille. En mode Stripe : redirige vers Checkout (le credit
// est applique par le webhook apres paiement). En simulation : credite direct.
export async function POST(req: Request) {
  const reseller = await currentReseller();
  if (!reseller) {
    return NextResponse.json({ ok: false, error: "Non connecte." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requete invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Montant invalide." }, { status: 400 });
  }

  if (paymentMode() === "live") {
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    try {
      const checkoutUrl = await createTopupSession({
        resellerId: reseller.id,
        amountCents: parsed.data.amountCents,
        email: reseller.email,
        origin,
      });
      return NextResponse.json({ ok: true, checkoutUrl });
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
    }
  }

  // Simulation : credit immediat.
  const balance = await topupWallet(reseller.id, parsed.data.amountCents, "TOPUP", "Recharge (simulation)");
  return NextResponse.json({ ok: true, balanceCents: balance });
}
