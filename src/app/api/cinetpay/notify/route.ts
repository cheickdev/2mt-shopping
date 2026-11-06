import { prisma } from "@/lib/db";
import { verifyPayment } from "@/lib/cinetpay";
import { markOrderPaidAndProcess } from "@/lib/orders";

// Notification serveur-a-serveur de CinetPay (notify_url).
// CinetPay envoie un POST x-www-form-urlencoded avec cpm_trans_id = notre
// transaction_id (= reference de commande). On ne se fie pas au contenu : on
// reinterroge toujours le statut reel via verifyPayment(). Doit renvoyer 200.
export async function POST(req: Request) {
  let transactionId: string | null = null;
  try {
    const form = await req.formData();
    transactionId = form.get("cpm_trans_id")?.toString() ?? null;
  } catch {
    // Corps inattendu : on renvoie 200 pour eviter que CinetPay ne reessaie en boucle.
    return new Response("OK", { status: 200 });
  }

  if (transactionId) {
    const { paid } = await verifyPayment(transactionId);
    if (paid) {
      const order = await prisma.order.findUnique({ where: { publicId: transactionId } });
      if (order) await markOrderPaidAndProcess(transactionId);
    }
  }

  return new Response("OK", { status: 200 });
}
