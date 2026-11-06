// Aides au formatage des prix et au calcul de marge.
// Tous les montants sont stockes en centimes (entiers) pour eviter les erreurs
// d'arrondi des nombres a virgule flottante.

export function formatMoney(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Marge en centimes. */
export function marginCents(priceCents: number, costCents: number): number {
  return priceCents - costCents;
}

/** Marge en pourcentage du prix de vente. */
export function marginPercent(priceCents: number, costCents: number): number {
  if (priceCents <= 0) return 0;
  return Math.round(((priceCents - costCents) / priceCents) * 100);
}
