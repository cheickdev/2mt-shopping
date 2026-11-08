// Authentification du tableau de bord avec DEUX roles :
//   - "owner" : le proprietaire — acces total (Parametres compris).
//   - "staff" : la partenaire — tout sauf les Parametres.
//
// Les mots de passe peuvent etre changes depuis l'app : on stocke alors un
// hash scrypt dans Setting (ownerPassHash / partnerPassHash). Si le hash est
// vide, on retombe sur la variable d'environnement (ADMIN_PASSWORD /
// PARTNER_PASSWORD). Le role est encode dans le cookie signe (HMAC) ; changer
// un mot de passe invalide les sessions de ce role.

import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const ADMIN_COOKIE = "admin_session";
export type Role = "owner" | "staff";

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-insecure-secret";
}

function envOwnerPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  if (process.env.NODE_ENV === "production") return crypto.randomBytes(32).toString("hex");
  return "2mt-admin";
}
function envStaffPassword(): string {
  return process.env.PARTNER_PASSWORD || "";
}

// --- Hachage des mots de passe (scrypt) -------------------------------------
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, salt, 32).toString("hex");
  return salt + ":" + h;
}
function verifyHash(pw: string, stored: string): boolean {
  const [salt, h] = stored.split(":");
  if (!salt || !h) return false;
  const calc = crypto.scryptSync(pw, salt, 32).toString("hex");
  return safeEqual(calc, h);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

interface AuthRow {
  ownerPassHash: string;
  partnerPassHash: string;
}

async function authRow(): Promise<AuthRow | null> {
  try {
    const s = await prisma.setting.findUnique({
      where: { id: "main" },
      select: { ownerPassHash: true, partnerPassHash: true },
    });
    return s ?? null;
  } catch {
    return null; // base pas encore initialisee : on utilisera les env
  }
}

// Cle de credential par role (change quand le mot de passe change) ; null si le
// role n'est pas disponible (partenaire sans mot de passe defini).
function credKey(role: Role, row: AuthRow | null): string | null {
  if (role === "owner") {
    return row?.ownerPassHash ? "h:" + row.ownerPassHash : "e:" + envOwnerPassword();
  }
  if (row?.partnerPassHash) return "h:" + row.partnerPassHash;
  const envp = envStaffPassword();
  return envp ? "e:" + envp : null;
}

function tokenFor(role: Role, row: AuthRow | null): string | null {
  const key = credKey(role, row);
  if (key === null) return null;
  return crypto.createHmac("sha256", sessionSecret()).update("admin:" + role + ":" + key).digest("hex");
}

function verifyFor(role: Role, pw: string, row: AuthRow | null): boolean {
  if (role === "owner") {
    if (row?.ownerPassHash) return verifyHash(pw, row.ownerPassHash);
    return safeEqual(pw ?? "", envOwnerPassword());
  }
  if (row?.partnerPassHash) return verifyHash(pw, row.partnerPassHash);
  const envp = envStaffPassword();
  return envp ? safeEqual(pw ?? "", envp) : false;
}

/** Jeton de cookie pour un role (apres connexion). */
export async function tokenForRole(role: Role): Promise<string | null> {
  return tokenFor(role, await authRow());
}

/** Verifie un mot de passe saisi et renvoie le role, ou null. */
export async function roleForPassword(pw: string): Promise<Role | null> {
  const row = await authRow();
  if (verifyFor("owner", pw, row)) return "owner";
  if (verifyFor("staff", pw, row)) return "staff";
  return null;
}

/** Role de la session courante (d'apres le cookie), ou null. */
export async function currentRole(): Promise<Role | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const row = await authRow();
  const ownerTok = tokenFor("owner", row);
  if (ownerTok && safeEqual(token, ownerTok)) return "owner";
  const staffTok = tokenFor("staff", row);
  if (staffTok && safeEqual(token, staffTok)) return "staff";
  return null;
}

export async function isAdmin(): Promise<boolean> {
  return (await currentRole()) !== null;
}

export async function isOwner(): Promise<boolean> {
  return (await currentRole()) === "owner";
}
