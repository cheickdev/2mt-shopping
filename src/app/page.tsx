import { prisma } from "@/lib/db";
import { getCategories } from "@/lib/categories";
import ProductCard, { ProductCardData } from "@/components/ProductCard";
import HeroCarousel, { CarouselItem } from "@/components/HeroCarousel";
import { matchProduct, productHref, queryWords, type ProductMatch } from "@/lib/search";
import { cardSelect, imageUrl, imageVersions, toCard } from "@/lib/product-cards";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24; // articles par page (categories, « tous les articles »)
const visible = { active: true, archived: false } as const;

type SP = { cat?: string; q?: string; tous?: string; page?: string };

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) || null;
  const categories = await getCategories();
  const activeCat = sp.cat && categories.includes(sp.cat) ? sp.cat : null;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // Tolere une base pas encore initialisee (boutique vide plutot qu'une erreur).
  try {
    // Appel direct (await) : une erreur de base est attrapee ici.
    if (q) return await SearchResults({ q });
    if (activeCat || sp.tous) return await Listing({ cat: activeCat, page });
    return await Accueil({ categories });
  } catch {
    return <Empty />;
  }
}

// ---------- Accueil : banniere + Coups de coeur uniquement ----------
async function Accueil({ categories }: { categories: string[] }) {
  let featured = await prisma.product.findMany({
    where: { ...visible, featured: true },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: cardSelect,
  });
  const noFeatured = featured.length === 0;
  if (noFeatured) {
    // Pas encore de « Coup de coeur » : on montre les nouveautes.
    featured = await prisma.product.findMany({ where: visible, orderBy: { createdAt: "desc" }, take: 12, select: cardSelect });
  }

  // Bandeau qui defile : coups de coeur avec photo, completes par les nouveautes.
  const withPhoto = { ...visible, imageData: { not: null } };
  let strip = await prisma.product.findMany({
    where: { ...withPhoto, featured: true },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, slug: true, name: true, price: true },
  });
  if (strip.length < 6) {
    const more = await prisma.product.findMany({
      where: { ...withPhoto, id: { notIn: strip.map((s) => s.id) } },
      orderBy: { createdAt: "desc" },
      take: 10 - strip.length,
      select: { id: true, slug: true, name: true, price: true },
    });
    strip = [...strip, ...more];
  }

  const versions = await imageVersions([...new Set([...featured.map((p) => p.id), ...strip.map((s) => s.id)])]);
  const carousel: CarouselItem[] = strip
    .map((s) => ({ slug: s.slug, name: s.name, price: s.price, image: imageUrl(s.id, versions) ?? "" }))
    .filter((s) => s.image);

  return (
    <>
      <section className="hero hero-compact">
        <div className="hero-text">
          <div className="eyebrow">Livraison à Bamako</div>
          <h1>La boutique qui vous livre chez vous</h1>
          <p>
            Commandez en ligne et <strong>payez à la livraison</strong>.
          </p>
          {categories.length > 0 && (
            <div className="cta-row">
              {categories.slice(0, 3).map((c, i) => (
                <a key={c} className={`btn sm ${i === 0 ? "" : "ghost"}`} href={`/?cat=${encodeURIComponent(c)}`}>
                  {c}
                </a>
              ))}
            </div>
          )}
        </div>
        <HeroCarousel items={carousel} />
      </section>

      <div className="section-head">
        <h2>{noFeatured ? "Nouveautés" : "⭐ Coups de cœur"}</h2>
        <a href="/?tous=1">Voir tous les articles →</a>
      </div>
      {featured.length === 0 ? <Empty /> : <Grid cards={featured.map((p) => toCard(p, versions))} />}

      {categories.length > 0 && (
        <>
          <div className="section-head">
            <h2>Nos catégories</h2>
          </div>
          <div className="cat-chips">
            {categories.map((c) => (
              <a key={c} className="cat-chip" href={`/?cat=${encodeURIComponent(c)}`}>
                {c}
              </a>
            ))}
            <a className="cat-chip all" href="/?tous=1">
              Tous les articles
            </a>
          </div>
        </>
      )}
    </>
  );
}

// ---------- Une categorie, ou tous les articles, par pages ----------
async function Listing({ cat, page }: { cat: string | null; page: number }) {
  const where = { ...visible, ...(cat ? { category: cat } : {}) };
  const total = await prisma.product.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: cardSelect,
  });
  const versions = await imageVersions(rows.map((p) => p.id));
  const base = cat ? `/?cat=${encodeURIComponent(cat)}` : "/?tous=1";
  return (
    <>
      <div className="section-head">
        <h2>
          {cat ?? "Tous les articles"} <span className="count">({total})</span>
        </h2>
        <a href="/">← Accueil</a>
      </div>
      {rows.length === 0 ? <Empty /> : <Grid cards={rows.map((p) => toCard(p, versions))} />}
      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          {current > 1 ? <a className="btn ghost sm" href={`${base}&page=${current - 1}`}>← Précédent</a> : <span />}
          <span className="note">
            Page {current} / {pages}
          </span>
          {current < pages ? <a className="btn sm" href={`${base}&page=${current + 1}`}>Suivant →</a> : <span />}
        </nav>
      )}
    </>
  );
}

// ---------- Recherche ----------
async function SearchResults({ q }: { q: string }) {
  const words = queryWords(q);
  // On cherche sur les textes seulement (sans les photos) : rapide meme avec beaucoup d'articles.
  const all = await prisma.product.findMany({
    where: visible,
    select: { id: true, slug: true, name: true, category: true, description: true, sizes: true, variants: { where: { active: true }, select: { id: true, label: true } } },
  });
  const scored = all
    .map((p) => ({ p, m: matchProduct(p, words) }))
    .filter((x): x is { p: (typeof all)[number]; m: ProductMatch } => x.m !== null)
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, 60);

  const ids = scored.map((x) => x.p.id);
  const rows = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: cardSelect }) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const versions = await imageVersions(ids);
  // Photo de la variete trouvee (si elle en a une).
  const variantIds = scored.map((x) => x.m.variants[0]?.id).filter((x): x is string => !!x);
  const variantImgs = variantIds.length
    ? new Map((await prisma.variant.findMany({ where: { id: { in: variantIds } }, select: { id: true, imageData: true } })).map((v) => [v.id, v.imageData]))
    : new Map<string, string | null>();

  const cards: ProductCardData[] = [];
  for (const { p, m } of scored) {
    const row = byId.get(p.id);
    if (!row) continue;
    let extra: Partial<ProductCardData> = {};
    if (m.variants[0]) {
      const img = variantImgs.get(m.variants[0].id);
      extra = { href: productHref(p.slug, { variantId: m.variants[0].id }), matched: m.variants[0].label, ...(img ? { imageData: img } : {}) };
    } else if (m.options[0]) extra = { href: productHref(p.slug, { option: m.options[0] }), matched: m.options[0] };
    cards.push(toCard(row, versions, extra));
  }

  return (
    <>
      <div className="section-head">
        <h2>Résultats pour « {q} »</h2>
        <a href="/">Tout voir</a>
      </div>
      {cards.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>
          <p className="note" style={{ margin: 0 }}>Aucun article ne correspond à « {q} ».</p>
        </div>
      ) : (
        <Grid cards={cards} />
      )}
    </>
  );
}

function Grid({ cards }: { cards: ProductCardData[] }) {
  return (
    <div className="grid">
      {cards.map((c, i) => (
        <ProductCard key={c.slug + (c.matched ?? "")} p={c} index={i} />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p className="note" style={{ margin: 0 }}>
        Aucun article pour le moment. Ajoutez vos produits depuis le tableau de bord (<a href="/admin">/admin</a>).
      </p>
    </div>
  );
}
