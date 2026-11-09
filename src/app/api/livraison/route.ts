import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings } from "@/lib/settings";
import { quoteDelivery } from "@/lib/delivery";

export const dynamic = "force-dynamic";

const schema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

// Prix de la livraison pour un point choisi sur la carte.
// Ne renvoie que le prix : la distance et la position de la boutique restent
// cotes serveur (seul l'admin voit la distance, dans les commandes).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Position invalide." }, { status: 400 });

  const s = await getSettings();
  const origin = s.shopLat != null && s.shopLng != null ? { lat: s.shopLat, lng: s.shopLng } : null;
  const q = quoteDelivery(origin, parsed.data, s.deliveryFee);
  return NextResponse.json(q.kind === "fee" ? { ok: true, kind: "fee", fee: q.fee } : { ok: true, kind: "contact" });
}
