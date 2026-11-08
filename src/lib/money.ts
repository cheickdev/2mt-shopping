// Formatage des montants en francs CFA (entiers, sans centimes).
// Ex. 12000 -> "12 000 F"

export function formatFcfa(amount: number): string {
  const n = Math.round(amount || 0);
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

/** Transforme une saisie texte ("12 000", "12000", "12.000") en entier FCFA. */
export function parseFcfa(input: string): number {
  const digits = (input || "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
