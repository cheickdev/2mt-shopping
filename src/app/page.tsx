import { prisma } from "@/lib/db";
import { getCategories } from "@/lib/categories";
import ProductCard, { ProductCardData } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

function productsQuery(activeCat: string | null) {
  return prisma.product.findMany({
    where: { active: true, archived: false, ...(activeCat ? { category: activeCat } : {}) },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    include: { variants: { where: { active: true }, select: { stock: true, label: true } } },
  });
}

// Recherche insensible aux accents et a la casse ("serum" trouve "Sérum").
// Elle porte aussi sur les varietes (ex. "Rouge", "Pointure 39", "100ml").
const norm = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function matches(
  p: { name: string; category: string; description: string; sizes: string; variants: { label: string }[] },
  q: string,
) {
  const labels = p.variants.map((v) => v.label).join(" ");
  const hay = norm(`${p.name} ${p.category} ${p.description} ${p.sizes.replace(/,/g, " ")} ${labels}`);
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const { cat, q: rawQ } = await searchParams;
  const q = rawQ?.trim().slice(0, 80) || null;

  const categories = await getCategories();
  const activeCat = cat && categories.includes(cat) ? cat : null;

  // Tolere une base pas encore initialisee (affiche une boutique vide plutot
  // qu'une erreur, le temps que l'admin clique sur "Initialiser la base").
  let products: Awaited<ReturnType<typeof productsQuery>> = [];
  try {
    products = await productsQuery(activeCat);
    if (q) products = products.filter((p) => matches(p, q));
  } catch {
    products = [];
  }

  const toCard = (p: (typeof products)[number]): ProductCardData => {
    const available = p.variants.length > 0 ? p.variants.some((v) => v.stock > 0) : p.stock > 0;
    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      price: p.price,
      available,
      imageData: p.imageData,
      featured: p.featured,
    };
  };

  return (
    <>
      {!activeCat && !q && (
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
        <h2>{q ? `Résultats pour « ${q} »` : activeCat ?? "Nos articles"}</h2>
        {(activeCat || q) && <a href="/">Tout voir</a>}
      </div>

      {products.length === 0 && q ? (
        <div className="card" style={{ padding: 20 }}>
          <p className="note" style={{ margin: 0 }}>Aucun article ne correspond à « {q} ».</p>
        </div>
      ) : products.length === 0 ? (
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
