// Integration Stripe (paiement).
//
// Mode pilote par la presence de STRIPE_SECRET_KEY :
//   - cle absente  -> mode "simulation" : la commande est consideree payee
//     immediatement (aucun paiement reel). Permet de tout tester sans compte.
//   - cle presente -> mode "live" : on cree une session Stripe Checkout et le
//     client est redirige vers la page de paiement hebergee par Stripe.

import Stripe from "stripe";

let client: Stripe | null = null;

/** Renvoie le client Stripe, ou null si aucune cle n'est configuree. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}

export function paymentMode(): "live" | "simulation" {
  return process.env.STRIPE_SECRET_KEY ? "live" : "simulation";
}

export interface CheckoutParams {
  publicId: string;
  serviceName: string;
  priceCents: number;
  currency: string;
  email: string;
  origin: string; // ex. "http://localhost:3000"
}

/**
 * Cree une session Stripe Checkout et renvoie l'URL de paiement.
 * L'identifiant public de la commande est stocke dans les metadata : le webhook
 * (et la confirmation au retour) s'en servent pour retrouver la commande.
 */
export async function createCheckoutSession(params: CheckoutParams): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe n'est pas configure (STRIPE_SECRET_KEY manquante).");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: params.priceCents,
          product_data: { name: params.serviceName },
        },
      },
    ],
    metadata: { publicId: params.publicId },
    success_url: `${params.origin}/order/${params.publicId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.origin}/order/${params.publicId}?canceled=1`,
  });

  if (!session.url) throw new Error("Stripe n'a pas renvoye d'URL de paiement.");
  return session.url;
}

/** Rembourse integralement un paiement a partir de son PaymentIntent. */
export async function refundPayment(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe n'est pas configure.");
  await stripe.refunds.create({ payment_intent: paymentIntentId });
}

export interface TopupParams {
  resellerId: string;
  amountCents: number;
  email: string;
  origin: string;
}

/** Cree une session Checkout pour recharger le portefeuille d'un revendeur. */
export async function createTopupSession(params: TopupParams): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe n'est pas configure.");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: params.amountCents,
          product_data: { name: "Recharge de portefeuille UnlockPro" },
        },
      },
    ],
    // kind=topup distingue cet evenement d'une commande dans le webhook.
    metadata: { kind: "topup", resellerId: params.resellerId, amountCents: String(params.amountCents) },
    success_url: `${params.origin}/reseller?topup=success`,
    cancel_url: `${params.origin}/reseller?topup=canceled`,
  });

  if (!session.url) throw new Error("Stripe n'a pas renvoye d'URL de paiement.");
  return session.url;
}
