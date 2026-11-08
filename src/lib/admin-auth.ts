// Authentification du tableau de bord avec DEUX roles :
//   - "owner"  : le proprietaire (mot de passe ADMIN_PASSWORD) — acces total.
//   - "staff"  : la partenaire (mot de passe PARTNER_PASSWORD) — tout sauf les
//                Parametres. Optionnel : si PARTNER_PASSWORD n'est pas defini,
//                il n'y a qu'un seul compte (owner).
// Le role est encode dans le cookie signe (HMAC) : on retrouve le role en
// testant a quel role correspond le jeton, sans stocker le role en clair.

import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";
export type Role = "owner" | "staff";

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-insecure-secret";
}

function ownerPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  if (process.env.NODE_ENV === "production") return crypto.randomBytes(32).toString("hex");
  return "2mt-admin";
}

// Mot de passe partenaire : vide => compte partenaire desactive.
function staffPassword(): string {
  return process.env.PARTNER_PASSWORD || "";
}

/** Jeton attendu dans le cookie pour un role donne. */
export function tokenFor(role: Role): string {
  const pw = role === "owner" ? ownerPassword() : staffPassword();
  return crypto.createHmac("sha256", sessionSecret()).update("admin:" + role + ":" + pw).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Verifie un mot de passe saisi et renvoie le role correspondant, ou null. */
export function roleForPassword(pw: string): Role | null {
  if (safeEqual(pw ?? "", ownerPassword())) return "owner";
  const sp = staffPassword();
  if (sp && safeEqual(pw ?? "", sp)) return "staff";
  return null;
}

/** Role de la session courante (d'apres le cookie), ou null si non connecte. */
export async function currentRole(): Promise<Role | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  if (safeEqual(token, tokenFor("owner"))) return "owner";
  if (staffPassword() && safeEqual(token, tokenFor("staff"))) return "staff";
  return null;
}

/** Vrai si la session est connectee (proprietaire OU partenaire). */
export async function isAdmin(): Promise<boolean> {
  return (await currentRole()) !== null;
}

/** Vrai si la session est le proprietaire (acces aux Parametres). */
export async function isOwner(): Promise<boolean> {
  return (await currentRole()) === "owner";
}
