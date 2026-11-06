// Devise d'AFFICHAGE selon le pays du visiteur.
//   - Mali (ML) -> FCFA (XOF)
//   - ailleurs  -> EUR
// Les prix restent stockes en centimes d'EURO ; on convertit juste pour l'affichage.
// Le paiement (CinetPay) se fait de toute facon en FCFA (parite fixe avec l'euro).
//
// La detection du pays repose sur l'en-tete geo de Vercel (x-vercel-ip-country),
// disponible en production. En local (absent), on affiche en euros par defaut.

import { headers } from "next/headers";
import { eurCentsToXof } from "@/lib/cinetpay";

export type DisplayCurrency = "EUR" | "XOF";

export async function getDisplayCurrency(): Promise<DisplayCurrency> {
  try {
    const h = await headers();
    const country = (h.get("x-vercel-ip-country") || "").toUpperCase();
    return country === "ML" ? "XOF" : "EUR";
  } catch {
    return "EUR";
  }
}

/** Formate un prix (stocke en centimes d'euro) dans la devise d'affichage. */
export function formatDisplayPrice(eurCents: number, currency: DisplayCurrency): string {
  if (currency === "XOF") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(eurCentsToXof(eurCents));
  }
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(eurCents / 100);
}
