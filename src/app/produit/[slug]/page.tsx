import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { VOTER_COOKIE } from "@/lib/ratings";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/money";
import { galleryOf } from "@/lib/gallery";
import ProductDetail, { ProductDetailData } from "@/components/ProductDetail";
import { publicProductWhere } from "@/lib/vendors";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.product.findFirst({ where: { ...publicProductWhere, slug } });
  if (!p) return { title: "Article introuvable" };
  const description = `${formatFcfa(p.price)} · Livraison à Bamako, paiement à la livraison.${p.description ? " " + p.description.slice(0, 150) : ""}`;
  // L'image de partage vient de ./opengraph-image.tsx (photo + nom + prix).
  return {
    title: p.name,
    description,
    alternates: { canonical: `/produit/${slug}` },
    openGraph: { title: `${p.name} — ${formatFcfa(p.price)}`, description, url: `/produit/${slug}`, siteName: "2MT - Shopping", type: "website", locale: "fr_FR" },
    twitter: { card: "summary_large_image", title: `${p.name} — ${formatFcfa(p.price)}`, description },
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
  const p = await prisma.product.findFirst({
    where: { ...publicProductWhere, slug },
    include: {
      vendor: { select: { name: true, slug: true, whatsapp: true } },
      variants: { where: { active: true }, orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!p) notFound();

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
    vendor: p.vendor ? { name: p.vendor.name, slug: p.vendor.slug } : null,
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
        whatsapp={p.vendor ? p.vendor.whatsapp : settings.whatsapp}
        deliveryFee={settings.shopLat != null ? 0 : settings.deliveryFee}
      />
    </>
  );
}
