import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listImeiServices, providerMode } from "@/lib/providers/dhru";

export const dynamic = "force-dynamic";

// Renvoie le catalogue du grossiste (action imeiservicelist). L'appel se fait
// cote serveur : la cle API n'est jamais transmise au navigateur.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "Non autorise." }, { status: 401 });
  }

  const result = await listImeiServices();
  return NextResponse.json({ ...result, mode: providerMode() }, { status: result.ok ? 200 : 400 });
}
