// Connecteur fournisseur.
//
// Deux modes, pilotes par la variable d'environnement PROVIDER_MODE :
//   - "simulation" (defaut) : aucune API externe. Les resultats sont fabriques
//     de maniere deterministe a partir de l'IMEI, pour tout tester sans compte.
//   - "live" : appelle une API DHRU Fusion reelle (le standard des grossistes
//     de codes). Renseignez DHRU_API_URL / DHRU_USERNAME / DHRU_API_KEY.
//
// L'interface publique (submitOrder) est identique dans les deux modes : le
// reste de l'application n'a pas besoin de savoir lequel est actif.

export type ProviderStatus = "DELIVERED" | "PROCESSING" | "FAILED";

export interface ProviderResult {
  status: ProviderStatus;
  providerRef?: string;
  resultText?: string;
  errorMessage?: string;
}

export interface SubmitParams {
  serviceType: "CHECK" | "UNLOCK";
  serviceSlug: string;
  dhruServiceId: string | null;
  imei: string;
}

function mode(): "simulation" | "live" {
  return process.env.PROVIDER_MODE === "live" ? "live" : "simulation";
}

// --- Utilitaire : nombre pseudo-aleatoire mais STABLE pour un IMEI donne -----
// Garantit qu'un meme IMEI donne toujours le meme resultat simule.
function seedFromImei(imei: string): number {
  let h = 0;
  for (const ch of imei) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// ============================================================================
// MODE SIMULATION
// ============================================================================
function simulate(params: SubmitParams): ProviderResult {
  const seed = seedFromImei(params.imei);
  const ref = "SIM-" + seed.toString(36).toUpperCase().slice(0, 8);

  if (params.serviceType === "UNLOCK") {
    // On fabrique un code de deblocage plausible a 16 chiffres.
    const code = (seed.toString().padStart(16, "7") + "000").slice(0, 16);
    return {
      status: "DELIVERED",
      providerRef: ref,
      resultText:
        `Code de deblocage : ${code}\n` +
        `Instructions : inserez une SIM d'un autre operateur, l'appareil demandera ` +
        `le code de deblocage reseau. Saisissez le code ci-dessus.\n\n` +
        `[RESULTAT SIMULE — aucun fournisseur reel n'a ete contacte]`,
    };
  }

  // Services de verification : on varie le resultat selon l'IMEI.
  const clean = seed % 3 !== 0; // ~2/3 "propres"
  const fmiOn = seed % 2 === 0;
  let report = "";
  switch (params.serviceSlug) {
    case "icloud-fmi-status":
      report =
        `Verrouillage iCloud : ${fmiOn ? "ACTIF" : "INACTIF"}\n` +
        `Localiser (Find My) : ${fmiOn ? "ON" : "OFF"}`;
      break;
    case "blacklist-status":
      report = `Statut Blacklist : ${clean ? "PROPRE (non signale)" : "BLOQUE (declare perdu/vole)"}`;
      break;
    case "carrier-lock-status":
      report =
        `Operateur d'origine : ${clean ? "Orange France" : "AT&T USA"}\n` +
        `Verrouillage reseau : ${clean ? "Debloque" : "Verrouille"}`;
      break;
    case "full-info-check":
      report =
        `Modele : iPhone (TAC ${params.imei.slice(0, 8)})\n` +
        `Capacite : 128 Go\nCouleur : Minuit\n` +
        `Garantie : ${clean ? "Active jusqu'au 2026-08-01" : "Expiree"}\n` +
        `Blacklist : ${clean ? "PROPRE" : "BLOQUE"}\n` +
        `iCloud / Localiser : ${fmiOn ? "ACTIF" : "INACTIF"}`;
      break;
    default:
      report = `Verification effectuee pour l'IMEI ${params.imei}.`;
  }

  return {
    status: "DELIVERED",
    providerRef: ref,
    resultText: report + `\n\n[RESULTAT SIMULE — aucun fournisseur reel n'a ete contacte]`,
  };
}

// ============================================================================
// MODE LIVE (API DHRU Fusion)
// ============================================================================
// NB : le format exact des parametres/reponses depend du grossiste. Ce
// squelette suit l'API DHRU Fusion standard ; ajustez le parsing au besoin.
async function callDhru(params: SubmitParams): Promise<ProviderResult> {
  const url = process.env.DHRU_API_URL;
  const username = process.env.DHRU_USERNAME;
  const apiKey = process.env.DHRU_API_KEY;

  if (!url || !username || !apiKey) {
    return {
      status: "FAILED",
      errorMessage:
        "Mode live actif mais identifiants DHRU manquants (DHRU_API_URL / DHRU_USERNAME / DHRU_API_KEY).",
    };
  }
  if (!params.dhruServiceId) {
    return {
      status: "FAILED",
      errorMessage: `Aucun identifiant de service fournisseur (dhruServiceId) configure pour "${params.serviceSlug}".`,
    };
  }

  const body = new URLSearchParams({
    username,
    apiaccesskey: apiKey,
    action: "placeimeiorder",
    requestformat: "JSON",
    parameters: JSON.stringify({ ID: params.dhruServiceId, IMEI: params.imei }),
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data: any = await res.json();

    // DHRU renvoie generalement { SUCCESS: [...] } ou { ERROR: [...] }.
    if (data?.ERROR) {
      const msg = Array.isArray(data.ERROR)
        ? data.ERROR[0]?.MESSAGE ?? "Erreur fournisseur."
        : String(data.ERROR);
      return { status: "FAILED", errorMessage: msg };
    }
    const success = Array.isArray(data?.SUCCESS) ? data.SUCCESS[0] : data?.SUCCESS;
    const providerRef = success?.REFERENCEID ? String(success.REFERENCEID) : undefined;
    const delivered = success?.CODE || success?.REPLY;

    if (delivered) {
      return { status: "DELIVERED", providerRef, resultText: String(delivered) };
    }
    // Commande acceptee mais pas encore traitee -> a recuperer plus tard.
    return { status: "PROCESSING", providerRef };
  } catch (err) {
    return {
      status: "FAILED",
      errorMessage: `Appel fournisseur echoue : ${(err as Error).message}`,
    };
  }
}

// --- Point d'entree unique ---------------------------------------------------
export async function submitOrder(params: SubmitParams): Promise<ProviderResult> {
  return mode() === "live" ? callDhru(params) : simulate(params);
}

export function providerMode(): "simulation" | "live" {
  return mode();
}
