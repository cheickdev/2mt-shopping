import { prisma } from "@/lib/db";
import { getCategories } from "@/lib/categories";
import ProductCard, { ProductCardData } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;

  const categories = await getCategories();
  const activeCat = cat && categories.includes(cat) ? cat : null;

  // Tolere une base pas encore initialisee (affiche une boutique vide plutot
  // qu'une erreur, le temps que l'admin clique sur "Initialiser la base").
  let products: Awaited<ReturnType<typeof prisma.product.findMany>> = [];
  try {
    products = await prisma.product.findMany({
      where: { active: true, ...(activeCat ? { category: activeCat } : {}) },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    });
  } catch {
    products = [];
  }

  const toCard = (p: (typeof products)[number]): ProductCardData => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    stock: p.stock,
    imageData: p.imageData,
    featured: p.featured,
  });

  return (
    <>
      {!activeCat && (
        <section className="hero">
          <div className="eyebrow">Livraison à Bamako</div>
          <h1>La boutique qui vous livre chez vous</h1>
          <p>
            Choisissez, commandez en ligne et <strong>payez à la livraison</strong>. Simple,
            rapide, partout à Bamako.
          </p>
          {categories.length > 0 && (
            <div className="cta-row">
              {categories.slice(0, 4).map((c, i) => (
                <a key={c} className={`btn ${i === 0 ? "" : "ghost"}`} href={`/?cat=${encodeURIComponent(c)}`}>
                  {c}
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="section-head">
        <h2>{activeCat ?? "Nos articles"}</h2>
        {activeCat && <a href="/">Tout voir</a>}
      </div>

      {products.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>
          <p className="note" style={{ margin: 0 }}>
            Aucun article pour le moment. Ajoutez vos produits depuis le tableau de bord
            (<a href="/admin">/admin</a>).
          </p>
        </div>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <ProductCard key={p.slug} p={toCard(p)} />
          ))}
        </div>
      )}
    </>
  );
}
