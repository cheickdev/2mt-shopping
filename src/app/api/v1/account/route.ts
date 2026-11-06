import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";

// GET /api/v1/account — informations du compte revendeur et solde.
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;
  const { reseller, headers } = auth;

  return NextResponse.json(
    {
      ok: true,
      account: {
        name: reseller.name,
        email: reseller.email,
        balanceCents: reseller.balanceCents,
        currency: "EUR",
        marginPercent: reseller.resellerMarginPercent,
        rateLimitPerMin: reseller.rateLimitPerMin,
      },
    },
    { headers },
  );
}
