// Authentification client grand public : email + mot de passe.
// Mot de passe hache avec scrypt (module crypto natif, aucune dependance).
// Session via cookie httpOnly signe (HMAC), comme pour admin et revendeur.

import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const CUSTOMER_COOKIE = "customer_session";

function secret(): string {
  return (
    process.env.CUSTOMER_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "dev-insecure-secret"
  );
}

// --- Mot de passe -----------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, derived] = stored.split(":");
  if (!salt || !derived) return false;
  const h = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(derived, "hex");
  return h.length === expected.length && crypto.timingSafeEqual(h, expected);
}

// --- Reinitialisation de mot de passe ---------------------------------------
// On envoie le token BRUT par email et on ne stocke que son hash en base.
export function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// --- Session (cookie signe) -------------------------------------------------
function sign(customerId: string): string {
  return crypto.createHmac("sha256", secret()).update("customer:" + customerId).digest("hex");
}

export function sessionValue(customerId: string): string {
  return `${customerId}.${sign(customerId)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export async function currentCustomer() {
  const store = await cookies();
  const raw = store.get(CUSTOMER_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!safeEqual(sig, sign(id))) return null;
  return prisma.customer.findUnique({ where: { id } });
}
