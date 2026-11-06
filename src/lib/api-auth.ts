// Authentification + limitation de debit pour l'API publique v1.
// Centralise la verification de la cle API et le quota par revendeur, et fournit
// les en-tetes X-RateLimit-* a attacher aux reponses.

import { NextResponse } from "next/server";
import type { Reseller } from "@prisma/client";
import { apiKeyFromRequest, resellerFromApiKey } from "@/lib/reseller-auth";
import { checkRateLimit } from "@/lib/rate-limit";

type AuthResult =
  | { ok: true; reseller: Reseller; headers: Record<string, string> }
  | { ok: false; response: NextResponse };

export async function authenticateApiRequest(req: Request): Promise<AuthResult> {
  const reseller = await resellerFromApiKey(apiKeyFromRequest(req));
  if (!reseller) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Cle API invalide." }, { status: 401 }) };
  }

  const rl = checkRateLimit(reseller.id, reseller.rateLimitPerMin);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  };

  if (!rl.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Limite de debit depassee. Reessayez dans un instant." },
        { status: 429, headers: { ...headers, "Retry-After": String(rl.retryAfterSec) } },
      ),
    };
  }

  return { ok: true, reseller, headers };
}
