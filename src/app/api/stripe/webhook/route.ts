import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { markOrderPaidAndProcess, topupWallet } from "@/lib/orders";
import { prisma } from "@/lib/db";

// Webhook Stripe : source de verite du paiement en production.
// Configurez l'endpoint dans le dashboard Stripe (ou via la Stripe CLI en dev)
// sur l'evenement "checkout.session.completed".
//
// En dev :
//   stripe listen --forward-to localhost:3000/api/stripe/webhook
// puis copiez le "whsec_..." affiche dans STRIPE_WEBHOOK_SECRET.

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return new Response("Stripe non configure.", { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Signature manquante.", { status: 400 });

  // Important : Stripe verifie la signature sur le corps BRUT, pas le JSON parse.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    return new Response(`Signature invalide : ${(err as Error).message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === "paid") {
      if (session.metadata?.kind === "topup") {
        // Recharge de portefeuille revendeur (idempotent par session Stripe).
        const resellerId = session.metadata.resellerId;
        const amountCents = Number(session.metadata.amountCents ?? 0);
        if (resellerId && amountCents > 0) {
          const already = await prisma.walletTransaction.findFirst({ where: { note: `stripe:${session.id}` } });
          if (!already) {
            await topupWallet(resellerId, amountCents, "TOPUP", `stripe:${session.id}`);
          }
        }
      } else if (session.metadata?.publicId) {
        // Paiement d'une commande.
        await markOrderPaidAndProcess(session.metadata.publicId, {
          sessionId: session.id,
          paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : null,
        });
      }
    }
  }

  return new Response("ok", { status: 200 });
}
