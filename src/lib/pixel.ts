// Envoi d'evenements au Pixel Facebook (Meta). Sans Pixel configure, ne fait rien.
// Devise : franc CFA (XOF).

type Fbq = (...args: unknown[]) => void;

export type PixelEvent = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase" | "Contact";

type PixelWindow = { fbq?: Fbq; __pixelPending?: [PixelEvent, Record<string, unknown> | undefined][] };

export function track(event: PixelEvent, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as PixelWindow;
  const fbq = w.fbq;
  if (!fbq) {
    // Pixel pas encore charge (ex. 1re page) : on garde l'evenement pour plus tard.
    const q = (w.__pixelPending ??= []);
    if (q.length < 30) q.push([event, params]);
    return;
  }
  try {
    if (params) fbq("track", event, params);
    else fbq("track", event);
  } catch {
    /* le suivi ne doit jamais casser la boutique */
  }
}

export const CURRENCY = "XOF";

/** Envoie les evenements gardes en attente (appele une fois le Pixel charge). */
export function flushPending() {
  if (typeof window === "undefined") return;
  const w = window as unknown as PixelWindow;
  const q = w.__pixelPending ?? [];
  w.__pixelPending = [];
  for (const [e, p] of q) if (e !== "PageView") track(e, p); // la page vue est deja comptee
}
