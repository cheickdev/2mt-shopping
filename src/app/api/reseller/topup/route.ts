import { NextResponse } from "next/server";
import { z } from "zod";
import { currentReseller } from "@/lib/reseller-auth";
import { paymentMode } from "@/lib/cinetpay";
import { topupWallet } from "@/lib/orders";

const schema = z.object({ amountCents: z.number().int().positive().max(1_000_000) });

// Recharge du portefeuille revendeur.
//   - Simulation (pas de cles CinetPay) : credit immediat, pour le dev/test.
//   - Live : la recharge en ligne en self-service n'est pas encore branchee ;
//     l'administrateur credite le solde manuellement depuis le back-office
//     (Revendeurs -> Ajuster solde). A implementer via CinetPay ulterieurement.
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
    return NextResponse.json(
      { ok: false, error: "La recharge en ligne arrive bientot. Contactez l'administrateur pour crediter votre compte." },
      { status: 503 },
    );
  }

  // Simulation : credit immediat.
  const balance = await topupWallet(reseller.id, parsed.data.amountCents, "TOPUP", "Recharge (simulation)");
  return NextResponse.json({ ok: true, balanceCents: balance });
}
