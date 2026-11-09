import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/admin-auth";
import type { ShopSettings } from "@/lib/settings";

// Donnees du menu lateral (☰) : categories deroulables avec leurs articles,
// et etat de connexion de l'administrateur.

export interface MenuCategory {
  name: string;
  count: number;
  products: { name: string; slug: string }[];
}

export interface MenuUser {
  name: string;
  role: "owner" | "staff";
}

const PRODUCTS_PER_CATEGORY = 8;

export async function getMenuCategories(): Promise<MenuCategory[]> {
  try {
    const rows = await prisma.product.findMany({
      where: { active: true, archived: false },
      select: { name: true, slug: true, category: true },
      orderBy: [{ category: "asc" }, { featured: "desc" }, { createdAt: "desc" }],
    });
    const map = new Map<string, MenuCategory>();
    for (const r of rows) {
      const cat = r.category?.trim();
      if (!cat) continue;
      let entry = map.get(cat);
      if (!entry) {
        entry = { name: cat, count: 0, products: [] };
        map.set(cat, entry);
      }
      entry.count++;
      if (entry.products.length < PRODUCTS_PER_CATEGORY) {
        entry.products.push({ name: r.name, slug: r.slug });
      }
    }
    return [...map.values()];
  } catch {
    return [];
  }
}

export async function getMenuUser(settings: ShopSettings): Promise<MenuUser | null> {
  const role = await currentRole();
  if (!role) return null;
  return { role, name: role === "owner" ? settings.ownerName : settings.partnerName };
}
