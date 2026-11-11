import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { VOTER_COOKIE } from "@/lib/ratings";

export const dynamic = "force-dynamic";

// Note d'un produit par un client (1 a 5 etoiles).
// Le visiteur est reconnu par un cookie anonyme : un vote par produit,
// revoter remplace sa note. La moyenne est recalculee et gardee sur le produit.

const body = z.object({ productId: z.string().min(1).max(60), stars: z.number().int().min(1).max(5) });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Note invalide." }, { status: 400 });
  const { productId, stars } = parsed.data;

  const product = await prisma.product.findFirst({ where: { id: productId, active: true, archived: false }, select: { id: true } });
  if (!product) return NextResponse.json({ ok: false, error: "Produit introuvable." }, { status: 404 });

  const store = await cookies();
  let voterId = store.get(VOTER_COOKIE)?.value ?? "";
  if (!/^[0-9a-f-]{36}$/.test(voterId)) voterId = randomUUID();

  await prisma.productRating.upsert({
    where: { productId_voterId: { productId, voterId } },
    create: { productId, voterId, stars },
    update: { stars, updatedAt: new Date() },
  });
  const agg = await prisma.productRating.aggregate({ where: { productId }, _avg: { stars: true }, _count: true });
  const avg = Math.round((agg._avg.stars ?? 0) * 10) / 10;
  await prisma.product.update({ where: { id: productId }, data: { ratingAvg: avg, ratingCount: agg._count } });

  const res = NextResponse.json({ ok: true, avg, count: agg._count, mine: stars });
  res.cookies.set(VOTER_COOKIE, voterId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 * 2 });
  return res;
}
