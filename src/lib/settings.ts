import { prisma } from "@/lib/db";

export interface ShopSettings {
  shopName: string;
  whatsapp: string;
  deliveryFee: number;
  partnerAPct: number;
  adBudget: number;
}

const DEFAULTS: ShopSettings = {
  shopName: "2MT - Shopping",
  whatsapp: "",
  deliveryFee: 1000,
  partnerAPct: 60,
  adBudget: 0,
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
    };
  } catch {
    return DEFAULTS;
  }
}
