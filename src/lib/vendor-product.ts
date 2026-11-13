import { z } from "zod";
import { galleryField } from "@/lib/gallery";

// Champs qu'un vendeur peut remplir pour son produit.
export const vendorProductSchema = z.object({
  name: z.string().trim().min(2, "Nom requis.").max(120),
  category: z.string().trim().min(1, "Catégorie requise.").max(40),
  description: z.string().max(2000).optional().default(""),
  price: z.number().int().positive("Indiquez le prix."),
  stock: z.number().int().nonnegative().default(1),
  sizes: z.string().max(300).optional().default(""),
  gallery: galleryField.min(1, "Ajoutez au moins une photo."),
});
export type VendorProductInput = z.infer<typeof vendorProductSchema>;
