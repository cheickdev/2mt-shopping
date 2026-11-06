// Connecteur de paiement CinetPay (Mobile Money + cartes, Afrique de l'Ouest).
// Remplace Stripe, indisponible au Mali.
//
// Modes, pilotes par la presence des identifiants :
//   - "simulation" (cles absentes) : la commande est consideree payee tout de
//     suite, aucun paiement reel. Permet de tout tester sans compte.
//   - "live" (CINETPAY_API_KEY + CINETPAY_SITE_ID) : on initialise un paiement
//     CinetPay et le client est redirige vers la page de paiement hebergee
//     (Orange Money, Moov, carte...).
//
// Les prix sont stockes en centimes d'EURO dans l'app ; CinetPay facture en
// FCFA (XOF), a parite fixe avec l'euro (1 EUR = 655,957 XOF). On convertit donc
// au moment du paiement, en arrondissant au multiple de 5 (exige par CinetPay).

const INIT_URL = "https://api-checkout.cinetpay.com/v2/payment";
const CHECK_URL = "https://api-checkout.cinetpay.com/v2/payment/check";
const EUR_TO_XOF = 655.957;

export function paymentMode(): "live" | "simulation" {
  return process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID ? "live" : "simulation";
}

/** Centimes d'euro -> FCFA (XOF), arrondi au multiple de 5, minimum 5. */
export function eurCentsToXof(cents: number): number {
  const xof = (cents / 100) * EUR_TO_XOF;
  return Math.max(5, Math.round(xof / 5) * 5);
}

export interface CinetPayInitParams {
  transactionId: string; // identifiant unique (ex. reference de commande)
  amountCents: number; // montant en centimes d'euro (converti en XOF)
  description: string;
  customerEmail: string;
  customerName?: string;
  origin: string; // ex. https://unlockpro.vercel.app
  returnPath: string; // ex. /order/UP-XXXX
}

/** Initialise un paiement et renvoie l'URL de paiement hebergee par CinetPay. */
export async function createPayment(p: CinetPayInitParams): Promise<string> {
  const apikey = process.env.CINETPAY_API_KEY;
  const site_id = process.env.CINETPAY_SITE_ID;
  if (!apikey || !site_id) throw new Error("CinetPay non configure.");

  const body = {
    apikey,
    site_id,
    transaction_id: p.transactionId,
    amount: eurCentsToXof(p.amountCents),
    currency: "XOF",
    // CinetPay deconseille certains caracteres speciaux dans les champs.
    description: p.description.replace(/[#/$_&]/g, " ").slice(0, 100),
    notify_url: `${p.origin}/api/cinetpay/notify`,
    return_url: `${p.origin}${p.returnPath}`,
    channels: "ALL", // Mobile Money + cartes
    customer_name: (p.customerName || p.customerEmail.split("@")[0] || "Client").slice(0, 100),
    customer_surname: "Client",
    customer_email: p.customerEmail,
    lang: "fr",
    metadata: p.transactionId,
  };

  const res = await fetch(INIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: { code?: string; message?: string; data?: { payment_url?: string } } = await res.json();

  if (data?.code !== "201" || !data?.data?.payment_url) {
    throw new Error(`CinetPay: initialisation refusee (${data?.code ?? "?"} ${data?.message ?? ""})`);
  }
  return data.data.payment_url;
}

export interface CinetPayStatus {
  paid: boolean;
  status: string;
}

/**
 * Verifie le statut reel d'une transaction aupres de CinetPay.
 * On ne se fie jamais a la seule notification : on reinterroge toujours ici.
 */
export async function verifyPayment(transactionId: string): Promise<CinetPayStatus> {
  const apikey = process.env.CINETPAY_API_KEY;
  const site_id = process.env.CINETPAY_SITE_ID;
  if (!apikey || !site_id) return { paid: false, status: "NOT_CONFIGURED" };

  const res = await fetch(CHECK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey, site_id, transaction_id: transactionId }),
  });
  const data: { code?: string; message?: string; data?: { status?: string } } = await res.json();

  const status = data?.data?.status ?? data?.message ?? "UNKNOWN";
  // code "00" + status ACCEPTED = paiement reussi.
  const paid = data?.code === "00" && status === "ACCEPTED";
  return { paid, status };
}
