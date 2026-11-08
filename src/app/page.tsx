import { prisma } from "@/lib/db";
import ProductCard, { ProductCardData } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

const CATS = [
  { key: "CHAUSSURES", label: "Chaussures" },
  { key: "COSMETIQUES", label: "Cosmétiques" },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const activeCat = cat && CATS.some((c) => c.key === cat) ? cat : null;

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
          <h1>Chaussures & cosmétiques, livrés chez vous</h1>
          <p>
            Choisissez, commandez en ligne et <strong>payez à la livraison</strong>. Simple,
            rapide, partout à Bamako.
          </p>
          <div className="cta-row">
            <a className="btn" href="/?cat=CHAUSSURES">Voir les chaussures</a>
            <a className="btn ghost" href="/?cat=COSMETIQUES">Voir les cosmétiques</a>
          </div>
        </section>
      )}

      <div className="section-head">
        <h2>{activeCat ? CATS.find((c) => c.key === activeCat)!.label : "Nos articles"}</h2>
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
