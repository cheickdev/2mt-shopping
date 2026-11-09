import { prisma } from "@/lib/db";
import { getCategories } from "@/lib/categories";
import ProductCard, { ProductCardData } from "@/components/ProductCard";
import { matchProduct, productHref, queryWords, type ProductMatch } from "@/lib/search";

export const dynamic = "force-dynamic";

function productsQuery(activeCat: string | null, withVariantImages = false) {
  return prisma.product.findMany({
    where: { active: true, archived: false, ...(activeCat ? { category: activeCat } : {}) },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    include: { variants: { where: { active: true }, orderBy: { position: "asc" }, select: { id: true, stock: true, label: true, imageData: withVariantImages } } },
  });
}

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const { cat, q: rawQ } = await searchParams;
  const q = rawQ?.trim().slice(0, 80) || null;

  const categories = await getCategories();
  const activeCat = cat && categories.includes(cat) ? cat : null;

  // Tolere une base pas encore initialisee (affiche une boutique vide plutot
  // qu'une erreur, le temps que l'admin clique sur "Initialiser la base").
  let products: Awaited<ReturnType<typeof productsQuery>> = [];
  const matchesBySlug = new Map<string, ProductMatch>();
  try {
    products = await productsQuery(activeCat, !!q);
    if (q) {
      const words = queryWords(q);
      const scored = products
        .map((p) => ({ p, m: matchProduct(p, words) }))
        .filter((x) => x.m !== null)
        .sort((a, b) => b.m!.score - a.m!.score);
      products = scored.map((x) => x.p);
      for (const x of scored) matchesBySlug.set(x.p.slug, x.m!);
    }
  } catch {
    products = [];
  }

  const variantLink = (p: (typeof products)[number]): Partial<ProductCardData> => {
    const slug = p.slug;
    const m = matchesBySlug.get(slug);
    if (m?.variants[0]) {
      const v = p.variants.find((x) => x.id === m.variants[0].id);
      return {
        href: productHref(slug, { variantId: m.variants[0].id }),
        matched: m.variants[0].label,
        ...(v?.imageData ? { imageData: v.imageData } : {}),
      };
    }
    if (m?.options[0]) return { href: productHref(slug, { option: m.options[0] }), matched: m.options[0] };
    return {};
  };

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
      // Recherche trouvee via une variete : la carte ouvre directement cette variete.
      ...variantLink(p),
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
