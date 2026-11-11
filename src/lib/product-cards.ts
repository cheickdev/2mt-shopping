import { prisma } from "@/lib/db";
import type { ProductCardData } from "@/components/ProductCard";

// Champs utiles a une carte produit — SANS la photo (servie par /api/image/[id]).
export const cardSelect = {
  id: true,
  slug: true,
  name: true,
  category: true,
  price: true,
  stock: true,
  sizes: true,
  featured: true,
  ratingAvg: true,
  ratingCount: true,
  variants: { where: { active: true }, select: { id: true, stock: true } },
} as const;

type CardRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  sizes: string;
  featured: boolean;
  ratingAvg: number;
  ratingCount: number;
  variants: { id: string; stock: number }[];
};

/** Empreinte courte de la photo de chaque produit (change quand la photo change). */
export async function imageVersions(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await prisma.$queryRaw<{ id: string; v: string | null }[]>`
    SELECT "id", substr(md5("imageData"), 1, 10) AS v FROM "Product" WHERE "id" = ANY(${ids}) AND "imageData" IS NOT NULL`;
  return new Map(rows.filter((r) => r.v).map((r) => [r.id, r.v as string]));
}

export function imageUrl(id: string, versions: Map<string, string>): string | null {
  const v = versions.get(id);
  return v ? `/api/image/${id}?v=${v}` : null;
}

export function toCard(p: CardRow, versions: Map<string, string>, extra: Partial<ProductCardData> = {}): ProductCardData {
  const available = p.variants.length > 0 ? p.variants.some((v) => v.stock > 0) : p.stock > 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    available,
    imageData: imageUrl(p.id, versions),
    featured: p.featured,
    needsChoice: p.variants.length > 0 || p.sizes.split(",").some((s) => s.trim()),
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    ...extra,
  };
}
