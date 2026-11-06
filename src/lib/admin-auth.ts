// Authentification admin minimaliste mais reelle : un mot de passe (ADMIN_PASSWORD)
// et un cookie httpOnly signe par HMAC. Suffisant pour un back-office a un seul
// operateur ; a remplacer par une vraie auth multi-utilisateurs plus tard.

import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-insecure-secret";
}

function adminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  // En production, pas de mot de passe par defaut : on renvoie une valeur
  // aleatoire inconnue -> la connexion admin est impossible tant qu'ADMIN_PASSWORD
  // n'est pas defini. En dev, valeur par defaut pratique "admin".
  if (process.env.NODE_ENV === "production") {
    return crypto.randomBytes(32).toString("hex");
  }
  return "admin";
}

/** Jeton attendu dans le cookie (lie au mot de passe : le changer invalide les sessions). */
export function expectedToken(): string {
  return crypto.createHmac("sha256", sessionSecret()).update("admin:" + adminPassword()).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Verifie un mot de passe saisi (comparaison a temps constant). */
export function checkPassword(pw: string): boolean {
  return safeEqual(pw ?? "", adminPassword());
}

/** Vrai si la requete courante porte un cookie admin valide. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return safeEqual(token, expectedToken());
}
