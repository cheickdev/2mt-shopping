// Verifications de configuration pour la production.
// Sert a l'endpoint de sante et aux garde-fous : on ne veut pas partir en ligne
// avec des secrets par defaut ou des services en mode simulation sans le savoir.

export const isProd = process.env.NODE_ENV === "production";

const INSECURE_SECRETS = ["", "dev-insecure-secret", "changez-moi-en-production", "changez-moi-aussi-en-production", "changez-moi-egalement-en-production"];

function insecure(value: string | undefined): boolean {
  return !value || INSECURE_SECRETS.includes(value);
}

/** Liste des avertissements de configuration pour la production (vide = pret). */
export function productionWarnings(): string[] {
  const w: string[] = [];

  if (!process.env.DATABASE_URL) {
    w.push("DATABASE_URL manquant.");
  } else if (process.env.DATABASE_URL.startsWith("file:")) {
    w.push("DATABASE_URL pointe vers SQLite : utilisez Postgres en production.");
  }

  if (!process.env.ADMIN_PASSWORD) w.push("ADMIN_PASSWORD non defini (acces admin impossible en production).");
  if (insecure(process.env.ADMIN_SESSION_SECRET)) w.push("ADMIN_SESSION_SECRET absent ou par defaut.");
  if (insecure(process.env.RESELLER_SESSION_SECRET) && insecure(process.env.ADMIN_SESSION_SECRET))
    w.push("RESELLER_SESSION_SECRET absent ou par defaut.");
  if (insecure(process.env.CUSTOMER_SESSION_SECRET) && insecure(process.env.ADMIN_SESSION_SECRET))
    w.push("CUSTOMER_SESSION_SECRET absent ou par defaut.");

  if (!process.env.STRIPE_SECRET_KEY) w.push("STRIPE_SECRET_KEY absent : les paiements sont simules.");
  else if (!process.env.STRIPE_WEBHOOK_SECRET) w.push("STRIPE_WEBHOOK_SECRET absent : le webhook ne pourra pas valider les paiements.");

  if (process.env.PROVIDER_MODE !== "live") w.push("PROVIDER_MODE n'est pas 'live' : le fournisseur est simule.");
  if (!process.env.RESEND_API_KEY) w.push("RESEND_API_KEY absent : les emails sont simules.");
  if (!process.env.NEXT_PUBLIC_SITE_URL) w.push("NEXT_PUBLIC_SITE_URL absent : URLs SEO/emails sur localhost.");

  return w;
}
