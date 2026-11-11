import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getCategories } from "@/lib/categories";

// Plan du site pour Google : accueil, categories et fiches produits.
export const revalidate = 3600;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.2mt.shop").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { active: true, archived: false }, select: { slug: true, createdAt: true } }).catch(() => []),
    getCategories(),
  ]);
  return [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/?tous=1`, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({ url: `${SITE}/?cat=${encodeURIComponent(c)}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${SITE}/produit/${p.slug}`, lastModified: p.createdAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
