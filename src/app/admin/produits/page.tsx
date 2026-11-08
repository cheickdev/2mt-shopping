import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getAllCategories } from "@/lib/categories";
import AdminShell from "../AdminShell";
import ProductsManager, { ProductRow } from "@/components/admin/ProductsManager";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      include: { variants: { orderBy: { position: "asc" } } },
    }),
    getAllCategories(),
  ]);
  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    description: p.description,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    sizes: p.sizes,
    imageData: p.imageData,
    featured: p.featured,
    active: p.active,
    variants: p.variants.map((v) => ({ id: v.id, label: v.label, stock: v.stock, imageData: v.imageData, active: v.active })),
  }));

  return (
    <AdminShell>
      <h1>Produits</h1>
      <p className="note" style={{ marginTop: 0 }}>Ajoutez vos chaussures et cosmétiques, avec photo, prix et stock.</p>
      <ProductsManager products={rows} categories={categories} />
    </AdminShell>
  );
}
