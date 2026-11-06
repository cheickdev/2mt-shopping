import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { markOrderPaidAndProcess } from "@/lib/orders";

// Confirmation au retour de Stripe Checkout.
// Appelee par la page de suivi avec le session_id present dans success_url.
// Sert de repli robuste quand le webhook n'est pas encore configure (ex. en
// developpement local sans Stripe CLI). Idempotente cote markOrderPaidAndProcess.
export async function GET(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "Stripe non configure." }, { status: 400 });
  }

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "session_id manquant." }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const publicId = session.metadata?.publicId;
    if (publicId && session.payment_status === "paid") {
      await markOrderPaidAndProcess(publicId, {
        sessionId: session.id,
        paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : null,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Paiement non confirme." }, { status: 402 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Verification du paiement echouee : ${(err as Error).message}` },
      { status: 400 },
    );
  }
}
