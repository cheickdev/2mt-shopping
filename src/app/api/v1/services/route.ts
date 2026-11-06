import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiRequest } from "@/lib/api-auth";
import { resellerPriceCents } from "@/lib/orders";

// GET /api/v1/services — catalogue avec le prix revendeur (cout + votre marge).
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;
  const { reseller, headers } = auth;

  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(
    {
      ok: true,
      services: services.map((s) => ({
        slug: s.slug,
        name: s.name,
        type: s.type,
        category: s.category,
        estimatedTime: s.estimatedTime,
        priceCents: resellerPriceCents(s.costCents, reseller.resellerMarginPercent),
        currency: s.currency,
      })),
    },
    { headers },
  );
}
