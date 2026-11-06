// Validation d'un IMEI.
// Un IMEI valide fait 15 chiffres : 14 chiffres + 1 chiffre de controle calcule
// par l'algorithme de Luhn. On accepte les espaces/tirets a la saisie.

export type ImeiValidation =
  | { valid: true; imei: string; tac: string }
  | { valid: false; reason: string };

/** Retire tout ce qui n'est pas un chiffre. */
export function normalizeImei(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/** Calcule la somme de Luhn sur une chaine de chiffres. */
function luhnChecksum(digits: string): number {
  let sum = 0;
  // On parcourt de droite a gauche ; un chiffre sur deux est double.
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - 1 - i;
    let d = Number(digits[fromRight]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10;
}

/** Verifie qu'un IMEI complet (15 chiffres) satisfait le controle de Luhn. */
export function isValidImei(input: string): boolean {
  const imei = normalizeImei(input);
  if (imei.length !== 15) return false;
  return luhnChecksum(imei) === 0;
}

/**
 * Valide un IMEI et renvoie un resultat exploitable (raison d'echec lisible,
 * ou IMEI normalise + TAC si valide). Le TAC (8 premiers chiffres) identifie
 * le modele de l'appareil.
 */
export function validateImei(input: string): ImeiValidation {
  const imei = normalizeImei(input);
  if (imei.length === 0) {
    return { valid: false, reason: "Veuillez saisir un IMEI." };
  }
  if (imei.length !== 15) {
    return {
      valid: false,
      reason: `Un IMEI doit comporter 15 chiffres (saisi : ${imei.length}). Composez *#06# sur le telephone.`,
    };
  }
  if (luhnChecksum(imei) !== 0) {
    return {
      valid: false,
      reason: "IMEI invalide : le chiffre de controle ne correspond pas. Verifiez la saisie.",
    };
  }
  return { valid: true, imei, tac: imei.slice(0, 8) };
}
