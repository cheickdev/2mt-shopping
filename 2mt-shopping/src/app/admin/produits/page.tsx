import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import AdminShell from "../AdminShell";
import ProductsManager, { ProductRow } from "@/components/admin/ProductsManager";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  if (!(await isAdmin())) redirect("/admin/login");

  const products = await prisma.product.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
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
  }));

  return (
    <AdminShell>
      <h1>Produits</h1>
      <p className="note" style={{ marginTop: 0 }}>Ajoutez vos chaussures et cosmétiques, avec photo, prix et stock.</p>
      <ProductsManager products={rows} />
    </AdminShell>
  );
}
