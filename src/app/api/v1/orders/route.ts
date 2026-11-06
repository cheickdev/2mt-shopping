import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/api-auth";
import { createApiOrder } from "@/lib/orders";

const schema = z.object({
  service: z.string().min(1), // slug du service
  imei: z.string().min(1),
});

// POST /api/v1/orders — place une commande (debite le portefeuille revendeur).
export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;
  const { reseller, headers } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide." }, { status: 400, headers });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Champs requis : service, imei." }, { status: 400, headers });
  }

  const result = await createApiOrder(reseller, parsed.data.service, parsed.data.imei);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status ?? 400, headers });
  }
  return NextResponse.json({ ok: true, order: result.order }, { headers });
}
