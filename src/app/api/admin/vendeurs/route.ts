import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOwner } from "@/lib/admin-auth";
import { hashVendorPassword, normalizeWhatsapp } from "@/lib/vendors";
import { slugify, randomSuffix } from "@/lib/slug";

export const dynamic = "force-dynamic";

// Noms reserves (pages /vendeur/connexion et /vendeur/espace).
const RESERVED = new Set(["connexion", "espace"]);

const schema = z.object({
  name: z.string().trim().min(2, "Nom du vendeur requis.").max(60),
  whatsapp: z.string().min(8, "Numéro WhatsApp requis."),
  password: z.string().min(6, "Mot de passe : 6 caractères minimum."),
  description: z.string().max(400).optional().default(""),
  maxProducts: z.number().int().min(1).max(500).default(20),
  freeUntil: z.string().nullable().optional(), // AAAA-MM-JJ
});

// Creer un vendeur (proprietaire uniquement).
export async function POST(req: Request) {
  if (!(await isOwner())) return NextResponse.json({ ok: false, error: "Réservé au propriétaire." }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  const d = parsed.data;
  const whatsapp = normalizeWhatsapp(d.whatsapp);
  if (whatsapp.length < 8) return NextResponse.json({ ok: false, error: "Numéro WhatsApp invalide." }, { status: 400 });
  if (await prisma.vendor.findFirst({ where: { whatsapp } })) {
    return NextResponse.json({ ok: false, error: "Un vendeur a déjà ce numéro." }, { status: 400 });
  }
  let slug = slugify(d.name) || "vendeur";
  if (RESERVED.has(slug) || (await prisma.vendor.findUnique({ where: { slug } }))) slug = `${slug}-${randomSuffix()}`;
  const v = await prisma.vendor.create({
    data: {
      slug,
      name: d.name,
      whatsapp,
      description: d.description,
      passHash: hashVendorPassword(d.password),
      maxProducts: d.maxProducts,
      freeUntil: d.freeUntil ? new Date(d.freeUntil) : null,
    },
  });
  return NextResponse.json({ ok: true, id: v.id, slug: v.slug });
}
