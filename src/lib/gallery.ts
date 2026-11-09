import { z } from "zod";
import { prisma } from "@/lib/db";

// Photos d'un produit : la 1re est la photo principale (Product.imageData),
// les suivantes vont dans ProductImage.
export const MAX_IMAGES = 8;
const MAX_IMAGE_CHARS = 1_800_000;

export const galleryField = z
  .array(z.string().startsWith("data:image/", "Image invalide.").max(MAX_IMAGE_CHARS, "Image trop lourde."))
  .max(MAX_IMAGES, `${MAX_IMAGES} photos maximum.`);

/** Remplace toutes les photos du produit par `gallery` (dans l'ordre). */
export async function saveGallery(productId: string, gallery: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.product.update({ where: { id: productId }, data: { imageData: gallery[0] ?? null } }),
    prisma.productImage.deleteMany({ where: { productId } }),
    ...(gallery.length > 1
      ? [
          prisma.productImage.createMany({
            data: gallery.slice(1).map((imageData, i) => ({ productId, imageData, position: i })),
          }),
        ]
      : []),
  ]);
}

/** Toutes les photos d'un produit, principale en premier. */
export function galleryOf(p: { imageData: string | null; images?: { imageData: string }[] }): string[] {
  return [p.imageData, ...(p.images ?? []).map((i) => i.imageData)].filter((x): x is string => !!x);
}
