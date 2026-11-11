import { prisma } from "@/lib/db";

export interface ShopSettings {
  shopName: string;
  whatsapp: string;
  deliveryFee: number;
  partnerAPct: number;
  adBudget: number;
  metaPixelId: string; // ID du Pixel Facebook, vide = pas de suivi
  ownerName: string;
  partnerName: string;
  shopLat: number | null; // point de depart des livraisons
  shopLng: number | null;
}

const DEFAULTS: ShopSettings = {
  shopName: "2MT - Shopping",
  whatsapp: "",
  deliveryFee: 1000,
  partnerAPct: 60,
  adBudget: 0,
  metaPixelId: "",
  ownerName: "Propriétaire",
  partnerName: "Partenaire",
  shopLat: null,
  shopLng: null,
};

/** Lit les parametres de la boutique (cree la ligne par defaut si absente). */
export async function getSettings(): Promise<ShopSettings> {
  try {
    const s = await prisma.setting.upsert({
      where: { id: "main" },
      update: {},
      create: { id: "main" },
    });
    return {
      shopName: s.shopName,
      whatsapp: s.whatsapp,
      deliveryFee: s.deliveryFee,
      partnerAPct: s.partnerAPct,
      adBudget: s.adBudget,
      metaPixelId: s.metaPixelId,
      ownerName: s.ownerName,
      partnerName: s.partnerName,
      shopLat: s.shopLat,
      shopLng: s.shopLng,
    };
  } catch {
    return DEFAULTS;
  }
}
