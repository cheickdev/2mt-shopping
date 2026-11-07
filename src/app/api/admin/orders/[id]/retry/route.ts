import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { processOrder, refreshOrder } from "@/lib/orders";

// Relance le traitement d'une commande.
//   - Si une reference fournisseur existe deja (commande deja passee), on se
//     contente d'aller RECHERCHER le resultat -> aucun credit redebite.
//   - Sinon (echec avant meme l'envoi), on (re)passe la commande.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "Non autorise." }, { status: 401 });
  }
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { publicId: id } });
  if (!order) return NextResponse.json({ ok: false, error: "Commande introuvable." }, { status: 404 });

  if (order.providerRef) {
    // La commande a deja ete transmise : on relit son etat, sans la repasser.
    await refreshOrder(id);
  } else {
    await processOrder(id);
  }

  const updated = await prisma.order.findUnique({ where: { publicId: id } });
  return NextResponse.json({ ok: true, status: updated?.status });
}
