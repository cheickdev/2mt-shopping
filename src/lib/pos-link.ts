// Lien entre 2MT et Simple Pos (logiciel de gestion de stock des vendeurs).
// Simple Pos appelle /api/sync/simple-pos avec une signature HMAC calculee avec
// le secret partage SYNC_SECRET (meme valeur dans les deux projets Vercel).
import crypto from "crypto";
import { safeEqual } from "@/lib/admin-auth";

const MAX_SKEW_MS = 5 * 60_000; // une requete de plus de 5 minutes est refusee (rejeu)

export function syncSecret(): string | null {
  const s = process.env.SYNC_SECRET ?? "";
  return s.length >= 16 ? s : null;
}

export function signPayload(secret: string, ts: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
}

/** Verifie l'en-tete de signature d'une requete Simple Pos. */
export function verifyRequest(headers: Headers, body: string): boolean {
  const secret = syncSecret();
  if (!secret) return false;
  const ts = headers.get("x-sp-timestamp") ?? "";
  const sig = headers.get("x-sp-signature") ?? "";
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > MAX_SKEW_MS) return false;
  return safeEqual(sig, signPayload(secret, ts, body));
}

/** Code de liaison lisible (sans 0/O/1/I), donne par le proprietaire au vendeur. */
export function newLinkCode(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "2MT-" + Array.from(crypto.randomBytes(6), (b) => A[b % A.length]).join("");
}
