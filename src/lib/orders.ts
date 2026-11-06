// Logique metier des commandes : creation, paiement (CinetPay ou simule) et
// traitement via le fournisseur. Centralise ici pour etre reutilisee par les
// routes API (prise de commande, notification CinetPay, confirmation au retour).

import { prisma } from "@/lib/db";
import { validateImei } from "@/lib/imei";
import { submitOrder } from "@/lib/providers/dhru";
import { paymentMode, createPayment } from "@/lib/cinetpay";
import { sendEmail, orderDeliveredEmail, orderFailedEmail } from "@/lib/email";

/** Reference courte et lisible montree au client, ex. "UP-7F3K9Q". */
function makePublicId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "UP-" + s;
}

export interface CreateOrderInput {
  serviceSlug: string;
  imei: string;
  email: string;
  origin: string; // origine de la requete, pour les URLs de retour du paiement
  customerId?: string | null; // client connecte (null = commande invitee)
}

export interface CreateOrderResult {
  ok: boolean;
  publicId?: string;
  checkoutUrl?: string; // present en mode paiement live : rediriger le client ici
  error?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  // 1. Validation de l'IMEI.
  const check = validateImei(input.imei);
  if (!check.valid) return { ok: false, error: check.reason };

  // 2. Validation basique de l'email.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email ?? "")) {
    return { ok: false, error: "Adresse email invalide." };
  }

  // 3. Le service existe et est actif ?
  const service = await prisma.service.findUnique({ where: { slug: input.serviceSlug } });
  if (!service || !service.active) {
    return { ok: false, error: "Service introuvable ou indisponible." };
  }

  // 4. Creation de la commande (statut PENDING = en attente de paiement).
  const order = await prisma.order.create({
    data: {
      publicId: makePublicId(),
      serviceId: service.id,
      serviceName: service.name,
      imei: check.imei,
      email: input.email,
      priceCents: service.priceCents,
      costCents: service.costCents,
      currency: service.currency,
      status: "PENDING",
      customerId: input.customerId ?? null,
    },
  });

  // 5. Paiement.
  if (paymentMode() === "live") {
    // On initialise un paiement CinetPay ; le client est redirige dessus.
    // Le traitement fournisseur n'aura lieu qu'APRES encaissement (notification
    // CinetPay / confirmation au retour), via markOrderPaidAndProcess().
    try {
      const checkoutUrl = await createPayment({
        transactionId: order.publicId,
        amountCents: order.priceCents,
        description: `Commande ${order.serviceName}`,
        customerEmail: order.email,
        origin: input.origin,
        returnPath: `/order/${order.publicId}`,
      });
      return { ok: true, publicId: order.publicId, checkoutUrl };
    } catch (err) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "FAILED", errorMessage: `Creation du paiement echouee : ${(err as Error).message}` },
      });
      return { ok: false, error: "Impossible de demarrer le paiement. Reessayez." };
    }
  }

  // Mode simulation : on considere la commande payee et on traite tout de suite.
  await markOrderPaidAndProcess(order.publicId);
  return { ok: true, publicId: order.publicId };
}

/**
 * Marque une commande comme payee puis la traite via le fournisseur.
 * Idempotent : si la commande n'est plus en attente de paiement, on ne fait
 * rien (protege contre un double appel webhook + confirmation au retour).
 */
export async function markOrderPaidAndProcess(publicId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { publicId } });
  if (!order) return;
  if (order.status !== "PENDING") return; // deja paye/traite

  await prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } });
  await processOrder(publicId);
}

/** Envoie la commande au fournisseur et enregistre le resultat. */
export async function processOrder(publicId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { publicId } });
  if (!order) return;

  const service = await prisma.service.findUnique({ where: { id: order.serviceId } });
  if (!service) return;

  await prisma.order.update({ where: { id: order.id }, data: { status: "PROCESSING" } });

  const result = await submitOrder({
    serviceType: service.type as "CHECK" | "UNLOCK",
    serviceSlug: service.slug,
    dhruServiceId: service.dhruServiceId,
    imei: order.imei,
  });

  if (result.status === "DELIVERED") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED", resultText: result.resultText, providerRef: result.providerRef },
    });
    // Email de resultat (commandes web uniquement ; les revendeurs lisent l'API).
    if (order.channel === "WEB") {
      const email = orderDeliveredEmail({
        publicId: order.publicId,
        serviceName: order.serviceName,
        imei: order.imei,
        resultText: result.resultText ?? null,
      });
      await sendEmail({ ...email, to: order.email });
    }
  } else if (result.status === "PROCESSING") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PROCESSING", providerRef: result.providerRef },
    });
  } else {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "FAILED", errorMessage: result.errorMessage },
    });
    if (order.channel === "WEB") {
      const email = orderFailedEmail({
        publicId: order.publicId,
        serviceName: order.serviceName,
        imei: order.imei,
      });
      await sendEmail({ ...email, to: order.email });
    }
  }
}

// ============================================================================
// Commandes via API revendeur (paiement par portefeuille prepaye)
// ============================================================================

/** Prix facture au revendeur = cout fournisseur + sa marge negociee. */
export function resellerPriceCents(costCents: number, marginPercent: number): number {
  return Math.round(costCents * (1 + marginPercent / 100));
}

/** Credite le portefeuille d'un revendeur et journalise le mouvement. */
export async function topupWallet(
  resellerId: string,
  amountCents: number,
  type: "TOPUP" | "REFUND" | "ADJUST",
  note?: string,
  orderId?: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.reseller.findUnique({ where: { id: resellerId } });
    if (!r) throw new Error("Revendeur introuvable.");
    const newBalance = r.balanceCents + amountCents;
    await tx.reseller.update({ where: { id: resellerId }, data: { balanceCents: newBalance } });
    await tx.walletTransaction.create({
      data: { resellerId, type, amountCents, balanceAfterCents: newBalance, note, orderId },
    });
    return newBalance;
  });
}

export interface ApiOrderResult {
  ok: boolean;
  status?: number; // code HTTP suggere en cas d'echec
  error?: string;
  order?: {
    publicId: string;
    service: string;
    imei: string;
    status: string;
    priceCents: number;
    currency: string;
    result: string | null;
    errorMessage: string | null;
  };
}

/**
 * Cree et traite une commande pour un revendeur via l'API.
 * Debite le portefeuille a la creation ; rembourse automatiquement si le
 * fournisseur echoue (on ne facture pas un deblocage non livre).
 */
export async function createApiOrder(
  reseller: { id: string; email: string; resellerMarginPercent: number },
  serviceSlug: string,
  imei: string,
): Promise<ApiOrderResult> {
  const check = validateImei(imei);
  if (!check.valid) return { ok: false, status: 400, error: check.reason };

  const service = await prisma.service.findUnique({ where: { slug: serviceSlug } });
  if (!service || !service.active) {
    return { ok: false, status: 404, error: "Service introuvable ou indisponible." };
  }

  const price = resellerPriceCents(service.costCents, reseller.resellerMarginPercent);

  // Debit atomique : on cree la commande seulement si le solde suffit.
  const created = await prisma.$transaction(async (tx) => {
    const r = await tx.reseller.findUnique({ where: { id: reseller.id } });
    if (!r || r.balanceCents < price) return null;
    const newBalance = r.balanceCents - price;
    await tx.reseller.update({ where: { id: r.id }, data: { balanceCents: newBalance } });
    const order = await tx.order.create({
      data: {
        publicId: makePublicId(),
        serviceId: service.id,
        serviceName: service.name,
        imei: check.imei,
        email: r.email,
        status: "PAID",
        channel: "API",
        resellerId: r.id,
        priceCents: price,
        costCents: service.costCents,
        currency: service.currency,
      },
    });
    await tx.walletTransaction.create({
      data: {
        resellerId: r.id,
        type: "DEBIT",
        amountCents: -price,
        balanceAfterCents: newBalance,
        orderId: order.id,
        note: service.slug,
      },
    });
    return order;
  });

  if (!created) return { ok: false, status: 402, error: "Solde insuffisant." };

  // Traitement fournisseur (hors transaction : appel reseau).
  await processOrder(created.publicId);
  const final = await prisma.order.findUnique({ where: { id: created.id } });

  // Remboursement automatique si echec.
  if (final?.status === "FAILED") {
    await topupWallet(reseller.id, price, "REFUND", "Echec fournisseur : remboursement", created.id);
  }

  return {
    ok: true,
    order: {
      publicId: created.publicId,
      service: service.name,
      imei: check.imei,
      status: final?.status ?? "PROCESSING",
      priceCents: price,
      currency: service.currency,
      result: final?.resultText ?? null,
      errorMessage: final?.errorMessage ?? null,
    },
  };
}
