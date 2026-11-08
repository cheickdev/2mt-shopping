import { prisma } from "@/lib/db";

// Liste des categories reellement presentes dans la boutique (produits actifs).
// Les categories sont libres : l'admin en cree autant qu'il veut.
export async function getCategories(): Promise<string[]> {
  try {
    const rows = await prisma.product.findMany({
      where: { active: true },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return rows.map((r) => r.category).filter((c) => c && c.trim() !== "");
  } catch {
    return [];
  }
}

// Toutes les categories (y compris produits masques) — pour les suggestions admin.
export async function getAllCategories(): Promise<string[]> {
  try {
    const rows = await prisma.product.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return rows.map((r) => r.category).filter((c) => c && c.trim() !== "");
  } catch {
    return [];
  }
}
