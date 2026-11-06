import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { productionWarnings } from "@/lib/config";
import { paymentMode } from "@/lib/stripe";
import { providerMode } from "@/lib/providers/dhru";
import { emailMode } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/health — etat de l'application (pour monitoring / uptime).
export async function GET() {
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }

  const warnings = productionWarnings();
  return NextResponse.json(
    {
      ok: db === "ok",
      db,
      modes: { payment: paymentMode(), provider: providerMode(), email: emailMode() },
      productionReady: warnings.length === 0,
      warnings,
      time: new Date().toISOString(),
    },
    { status: db === "ok" ? 200 : 503 },
  );
}
