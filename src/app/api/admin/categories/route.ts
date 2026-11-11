import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { cleanCategoryName, proposeCategory } from "@/lib/category-plan";

export const dynamic = "force-dynamic";

// Ranger les categories :
//  - rename : renomme (ou fusionne si le nouveau nom existe deja) une categorie ;
//  - move   : change la categorie d'un produit ;
//  - plan   : applique le rangement propose (voir lib/category-plan).
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), from: z.string().min(1).max(100), to: z.string().min(1).max(100) }),
  z.object({ action: z.literal("move"), productId: z.string().min(1).max(60), to: z.string().min(1).max(100) }),
  z.object({ action: z.literal("plan") }),
]);

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Demande invalide." }, { status: 400 });
  const d = parsed.data;

  if (d.action === "rename") {
    const to = cleanCategoryName(d.to);
    if (!to) return NextResponse.json({ ok: false, error: "Nom vide." }, { status: 400 });
    const r = await prisma.product.updateMany({ where: { category: d.from }, data: { category: to } });
    return NextResponse.json({ ok: true, changed: r.count });
  }
  if (d.action === "move") {
    const to = cleanCategoryName(d.to);
    if (!to) return NextResponse.json({ ok: false, error: "Nom vide." }, { status: 400 });
    await prisma.product.update({ where: { id: d.productId }, data: { category: to } });
    return NextResponse.json({ ok: true, changed: 1 });
  }
  // plan
  const products = await prisma.product.findMany({ where: { archived: false }, select: { id: true, name: true, category: true } });
  const moves = products
    .map((p) => ({ id: p.id, to: proposeCategory(p.name, p.category) }))
    .filter((m, i): m is { id: string; to: string } => !!m.to && m.to !== products[i].category);
  await prisma.$transaction(moves.map((m) => prisma.product.update({ where: { id: m.id }, data: { category: m.to } })));
  return NextResponse.json({ ok: true, changed: moves.length });
}
