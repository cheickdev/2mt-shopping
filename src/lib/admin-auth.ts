// Authentification du tableau de bord (vous deux) : un mot de passe partage
// (ADMIN_PASSWORD) et un cookie httpOnly signe par HMAC. Simple mais reel.
// A faire evoluer vers des comptes separes plus tard.

import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-insecure-secret";
}

function adminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  // En production, aucun mot de passe par defaut : connexion impossible tant
  // qu'ADMIN_PASSWORD n'est pas defini. En dev, valeur pratique "2mt-admin".
  if (process.env.NODE_ENV === "production") {
    return crypto.randomBytes(32).toString("hex");
  }
  return "2mt-admin";
}

export function expectedToken(): string {
  return crypto.createHmac("sha256", sessionSecret()).update("admin:" + adminPassword()).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function checkPassword(pw: string): boolean {
  return safeEqual(pw ?? "", adminPassword());
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return safeEqual(token, expectedToken());
}
