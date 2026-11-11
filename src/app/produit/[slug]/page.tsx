import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { VOTER_COOKIE } from "@/lib/ratings";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/money";
import { galleryOf } from "@/lib/gallery";
import ProductDetail, { ProductDetailData } from "@/components/ProductDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.product.findUnique({ where: { slug } });
  if (!p) return { title: "Article introuvable" };
  return {
    title: p.name,
    description: p.description || `${p.name} — ${formatFcfa(p.price)}. Livraison à Bamako.`,
  };
}

function parseSizes(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string; opt?: string }>;
}) {
  const { slug } = await params;
  const { v, opt } = await searchParams;
  const p = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: { where: { active: true }, orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!p || !p.active || p.archived) notFound();

  const settings = await getSettings();
  const voterId = (await cookies()).get(VOTER_COOKIE)?.value;
  const mine = voterId
    ? await prisma.productRating.findUnique({ where: { productId_voterId: { productId: p.id, voterId } }, select: { stars: true } })
    : null;
  const product: ProductDetailData = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    description: p.description,
    price: p.price,
    image: p.imageData,
    images: galleryOf(p),
    stock: p.stock,
    variants: p.variants.map((v) => ({ id: v.id, label: v.label, stock: v.stock, image: v.imageData })),
    sizes: parseSizes(p.sizes),
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    myRating: mine?.stars ?? null,
  };

  return (
    <>
      <nav className="note" style={{ marginTop: 16 }}>
        <a href="/" style={{ textDecoration: "none", color: "var(--muted)" }}>Accueil</a>
        {" › "}
        <a href={`/?cat=${encodeURIComponent(p.category)}`} style={{ textDecoration: "none", color: "var(--muted)" }}>
          {p.category}
        </a>
        {" › "}
        <span>{p.name}</span>
      </nav>

      <ProductDetail
        product={product}
        initialVariantId={product.variants.some((x) => x.id === v) ? v : undefined}
        initialOption={opt && product.sizes.includes(opt) ? opt : undefined}
        whatsapp={settings.whatsapp}
        deliveryFee={settings.shopLat != null ? 0 : settings.deliveryFee}
      />
    </>
  );
}
