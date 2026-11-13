import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentVendor } from "@/lib/vendors";
import { vendorProductSchema } from "@/lib/vendor-product";
import { saveGallery } from "@/lib/gallery";
import { slugify, randomSuffix } from "@/lib/slug";

export const dynamic = "force-dynamic";

// Un vendeur ajoute un produit : il reste « en attente » jusqu'a la validation du proprietaire.
export async function POST(req: Request) {
  const me = await currentVendor();
  if (!me) return NextResponse.json({ ok: false, error: "Connectez-vous." }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = vendorProductSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  const d = parsed.data;

  const count = await prisma.product.count({ where: { vendorId: me.id, archived: false } });
  if (count >= me.maxProducts) {
    return NextResponse.json({ ok: false, error: `Limite atteinte : ${me.maxProducts} produits maximum. Supprimez-en un ou contactez 2MT.` }, { status: 400 });
  }

  let slug = slugify(d.name) || "article";
  if (await prisma.product.findUnique({ where: { slug } })) slug = `${slug}-${randomSuffix()}`;
  const product = await prisma.product.create({
    data: {
      slug,
      name: d.name,
      category: d.category,
      description: d.description,
      price: d.price,
      stock: d.stock,
      sizes: d.sizes,
      vendorId: me.id,
      status: "PENDING",
      active: true,
    },
  });
  await saveGallery(product.id, d.gallery);
  return NextResponse.json({ ok: true, id: product.id });
}
