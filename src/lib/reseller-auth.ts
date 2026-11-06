// Authentification revendeur.
//  - Pour l'API : cle API dans l'en-tete Authorization (Bearer) ou x-api-key.
//  - Pour le tableau de bord web : cookie de session signe, obtenu en se
//    connectant avec sa cle API.

import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const RESELLER_COOKIE = "reseller_session";

function secret(): string {
  return (
    process.env.RESELLER_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "dev-insecure-secret"
  );
}

/** Genere une cle API revendeur. */
export function generateApiKey(): string {
  return "rk_" + crypto.randomBytes(24).toString("hex");
}

/** Version tronquee pour affichage (ne jamais exposer la cle complete cote admin). */
export function maskKey(key: string): string {
  if (key.length <= 10) return key;
  return key.slice(0, 7) + "…" + key.slice(-4);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// --- Cle API (API) ----------------------------------------------------------
/** Extrait la cle API d'une requete (Authorization: Bearer xxx, ou x-api-key). */
export function apiKeyFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const x = req.headers.get("x-api-key");
  return x ? x.trim() : null;
}

/** Retrouve un revendeur actif a partir de sa cle API. */
export async function resellerFromApiKey(key: string | null) {
  if (!key) return null;
  const reseller = await prisma.reseller.findUnique({ where: { apiKey: key } });
  if (!reseller || !reseller.active) return null;
  return reseller;
}

// --- Cookie de session (tableau de bord web) --------------------------------
function sign(resellerId: string): string {
  return crypto.createHmac("sha256", secret()).update("reseller:" + resellerId).digest("hex");
}

export function sessionValue(resellerId: string): string {
  return `${resellerId}.${sign(resellerId)}`;
}

export async function currentReseller() {
  const store = await cookies();
  const raw = store.get(RESELLER_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!safeEqual(sig, sign(id))) return null;
  const reseller = await prisma.reseller.findUnique({ where: { id } });
  if (!reseller || !reseller.active) return null;
  return reseller;
}
