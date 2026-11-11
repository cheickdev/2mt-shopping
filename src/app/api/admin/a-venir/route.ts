import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Liste des « produits a venir » (reperes dans les tendances).
const item = z.object({
  title: z.string().min(1).max(200),
  imageUrl: z.string().max(2000).default(""),
  price: z.string().max(60).default(""),
  priceFcfa: z.number().int().nullable().default(null),
  source: z.string().max(120).default(""),
  link: z.string().max(2000).default(""),
  rating: z.number().nullable().default(null),
  ratingCount: z.number().int().nullable().default(null),
});
const addBody = z.object({ items: z.array(item).min(1).max(60), query: z.string().max(100).default("") });

const deny = () => NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });

export async function GET() {
  if (!(await isAdmin())) return deny();
  const list = await prisma.upcomingProduct.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ok: true, list });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return deny();
  const parsed = addBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Sélection invalide." }, { status: 400 });
  const { items, query } = parsed.data;
  // Pas de doublon : meme nom deja dans la liste.
  const existing = new Set((await prisma.upcomingProduct.findMany({ select: { name: true } })).map((x) => x.name.toLowerCase()));
  const fresh = items.filter((i) => !existing.has(i.title.toLowerCase()));
  if (fresh.length) {
    await prisma.upcomingProduct.createMany({
      data: fresh.map((i) => ({
        name: i.title,
        imageUrl: i.imageUrl.startsWith("http") ? i.imageUrl : "",
        price: i.price,
        priceFcfa: i.priceFcfa,
        source: i.source,
        link: i.link.startsWith("http") ? i.link : "",
        rating: i.rating,
        ratingCount: i.ratingCount,
        query,
      })),
    });
  }
  return NextResponse.json({ ok: true, added: fresh.length, skipped: items.length - fresh.length });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return deny();
  const parsed = z.object({ id: z.string().min(1), note: z.string().max(500) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  await prisma.upcomingProduct.update({ where: { id: parsed.data.id }, data: { note: parsed.data.note } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return deny();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  await prisma.upcomingProduct.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
