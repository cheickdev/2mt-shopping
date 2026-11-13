import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOwner } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  productId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(300).optional().default(""),
});

// Valider ou refuser un produit propose par un vendeur.
export async function POST(req: Request) {
  if (!(await isOwner())) return NextResponse.json({ ok: false, error: "Réservé au propriétaire." }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Champs invalides." }, { status: 400 });
  const { productId, action, reason } = parsed.data;
  const p = await prisma.product.findFirst({ where: { id: productId, vendorId: { not: null } } });
  if (!p) return NextResponse.json({ ok: false, error: "Produit introuvable." }, { status: 404 });
  await prisma.product.update({
    where: { id: productId },
    data: action === "approve" ? { status: "APPROVED", rejectReason: "" } : { status: "REJECTED", rejectReason: reason.trim() || "Ne respecte pas les règles du site." },
  });
  return NextResponse.json({ ok: true });
}
