import { formatFcfa } from "@/lib/money";

export interface ProductCardData {
  slug: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
  imageData: string | null;
  featured: boolean;
  href?: string; // lien (par defaut : la fiche produit)
  matched?: string; // variete trouvee par la recherche
}

export default function ProductCard({ p }: { p: ProductCardData }) {
  const out = !p.available;
  return (
    <a href={p.href ?? `/produit/${p.slug}`} className="card">
      <div className="thumb">
        {p.featured && <span className="chip gold">Coup de cœur</span>}
        {p.imageData ? (
          <img src={p.imageData} alt={p.name} loading="lazy" />
        ) : (
          <div className="ph">Photo à venir</div>
        )}
      </div>
      <div className="card-body">
        <div className="card-cat">{p.category}</div>
        <div className="card-name">{p.name}</div>
        {p.matched && <div className="card-variant">Variété : {p.matched}</div>}
        <div className="card-foot">
          <div className="price">{formatFcfa(p.price)}</div>
          {out ? <span className="stock-out">Rupture</span> : null}
        </div>
      </div>
    </a>
  );
}
