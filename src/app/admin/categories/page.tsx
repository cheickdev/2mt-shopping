import { redirect } from "next/navigation";
import { currentRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { proposeCategory } from "@/lib/category-plan";
import AdminShell from "../AdminShell";
import CategoriesManager, { CatProduct } from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategories() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  const [products, settings] = await Promise.all([
    prisma.product.findMany({
      where: { archived: false },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, active: true },
    }),
    getSettings(),
  ]);
  const rows: CatProduct[] = products.map((p) => ({ ...p, proposed: proposeCategory(p.name, p.category) }));
  const userName = role === "owner" ? settings.ownerName : settings.partnerName;
  return (
    <AdminShell owner={role === "owner"} userName={userName}>
      <h1>Catégories</h1>
      <p className="note" style={{ marginTop: 0 }}>
        Rangez vos produits dans des catégories claires : elles forment le menu de la boutique.
      </p>
      <CategoriesManager products={rows} />
    </AdminShell>
  );
}
