// Limitation de debit par cle (ici : par revendeur), fenetre fixe d'une minute.
//
// Implementation EN MEMOIRE : simple et rapide, suffisante pour un seul serveur.
// En production serverless multi-instances, remplacez le stockage par un service
// partage (Redis / Upstash) ; l'interface publique peut rester identique.

interface Window {
  count: number;
  resetAt: number; // timestamp (ms) de reinitialisation
}

const store = new Map<string, Window>();
const WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

export function checkRateLimit(key: string, limitPerMin: number): RateLimitResult {
  const now = Date.now();

  // Nettoyage opportuniste des fenetres expirees pour borner la memoire.
  if (store.size > 5000) {
    for (const [k, w] of store) if (w.resetAt <= now) store.delete(k);
  }

  let w = store.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, w);
  }
  w.count += 1;

  const remaining = Math.max(0, limitPerMin - w.count);
  return {
    allowed: w.count <= limitPerMin,
    limit: limitPerMin,
    remaining,
    resetAt: w.resetAt,
    retryAfterSec: Math.ceil((w.resetAt - now) / 1000),
  };
}
