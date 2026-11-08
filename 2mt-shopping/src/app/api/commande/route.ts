import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  customerName: z.string().min(2, "Nom trop court."),
  customerPhone: z.string().min(6, "Téléphone invalide."),
  quartier: z.string().min(2, "Indiquez votre quartier."),
  note: z.string().optional().default(""),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variant: z.string().optional().default(""),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, "Votre panier est vide."),
});

function makePublicId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "2MT-" + s;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  }
  const data = parsed.data;

  // On recalcule tout depuis la base (on ne fait jamais confiance aux prix du navigateur).
  const ids = [...new Set(data.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: ids }, active: true } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: { productId: string; name: string; price: number; cost: number; quantity: number; variant: string }[] = [];
  for (const item of data.items) {
    const p = byId.get(item.productId);
    if (!p) return NextResponse.json({ ok: false, error: "Un article n'est plus disponible." }, { status: 400 });
    if (p.stock < item.quantity) {
      return NextResponse.json({ ok: false, error: `Stock insuffisant pour « ${p.name} ».` }, { status: 400 });
    }
    lines.push({ productId: p.id, name: p.name, price: p.price, cost: p.cost, quantity: item.quantity, variant: item.variant ?? "" });
  }

  const settings = await getSettings();
  const itemsTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const deliveryFee = settings.deliveryFee;
  const total = itemsTotal + deliveryFee;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        publicId: makePublicId(),
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        quartier: data.quartier,
        note: data.note ?? "",
        status: "NOUVELLE",
        paymentMethod: "LIVRAISON",
        itemsTotal,
        deliveryFee,
        total,
        items: { create: lines },
      },
    });
    // Decremente le stock.
    for (const l of lines) {
      await tx.product.update({ where: { id: l.productId }, data: { stock: { decrement: l.quantity } } });
    }
    return created;
  });

  return NextResponse.json({ ok: true, publicId: order.publicId });
}
