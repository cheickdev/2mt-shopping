import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { quoteDelivery } from "@/lib/delivery";

const schema = z.object({
  customerName: z.string().min(2, "Nom trop court."),
  customerPhone: z.string().min(6, "Téléphone invalide."),
  quartier: z.string().min(2, "Indiquez votre quartier."),
  note: z.string().optional().default(""),
  // Adresse de livraison choisie sur la carte.
  location: z.object(
    { lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) },
    { required_error: "Choisissez votre adresse de livraison sur la carte.", invalid_type_error: "Choisissez votre adresse de livraison sur la carte." }
  ),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variant: z.string().optional().default(""),
        variantId: z.string().nullable().optional(),
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

  const variantIds = data.items.map((i) => i.variantId).filter((v): v is string => !!v);
  const variants = variantIds.length
    ? await prisma.variant.findMany({ where: { id: { in: variantIds } } })
    : [];
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const lines: {
    productId: string;
    name: string;
    price: number;
    cost: number;
    quantity: number;
    variant: string;
    variantId: string | null;
  }[] = [];

  for (const item of data.items) {
    const p = byId.get(item.productId);
    if (!p) return NextResponse.json({ ok: false, error: "Un article n'est plus disponible." }, { status: 400 });

    if (item.variantId) {
      const v = variantById.get(item.variantId);
      if (!v || v.productId !== p.id || !v.active) {
        return NextResponse.json({ ok: false, error: `Une variété de « ${p.name} » n'est plus disponible.` }, { status: 400 });
      }
      if (v.stock < item.quantity) {
        return NextResponse.json({ ok: false, error: `Stock insuffisant pour « ${p.name} — ${v.label} ».` }, { status: 400 });
      }
      lines.push({ productId: p.id, name: p.name, price: p.price, cost: p.cost, quantity: item.quantity, variant: v.label, variantId: v.id });
    } else {
      if (p.stock < item.quantity) {
        return NextResponse.json({ ok: false, error: `Stock insuffisant pour « ${p.name} ».` }, { status: 400 });
      }
      lines.push({ productId: p.id, name: p.name, price: p.price, cost: p.cost, quantity: item.quantity, variant: item.variant ?? "", variantId: null });
    }
  }

  const settings = await getSettings();
  const itemsTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  // Frais recalcules ici depuis le point de depart (on ne fait pas confiance au navigateur).
  const origin = settings.shopLat != null && settings.shopLng != null ? { lat: settings.shopLat, lng: settings.shopLng } : null;
  const quote = quoteDelivery(origin, data.location, settings.deliveryFee);
  const deliveryFee = quote.kind === "fee" ? quote.fee : 0;
  const deliveryToConfirm = quote.kind === "contact";
  const deliveryKm = quote.km;
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
        deliveryLat: data.location.lat,
        deliveryLng: data.location.lng,
        deliveryKm,
        deliveryToConfirm,
        total,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            price: l.price,
            cost: l.cost,
            quantity: l.quantity,
            variant: l.variant,
            variantId: l.variantId,
          })),
        },
      },
    });
    // Decremente le stock de la bonne variete, ou du produit si pas de variete.
    for (const l of lines) {
      if (l.variantId) {
        await tx.variant.update({ where: { id: l.variantId }, data: { stock: { decrement: l.quantity } } });
      } else {
        await tx.product.update({ where: { id: l.productId }, data: { stock: { decrement: l.quantity } } });
      }
    }
    return created;
  });

  return NextResponse.json({ ok: true, publicId: order.publicId, total: order.total });
}
