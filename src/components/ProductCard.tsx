import { formatFcfa } from "@/lib/money";
import QuickAdd from "@/components/QuickAdd";
import Stars from "@/components/Stars";

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
  imageData: string | null;
  featured: boolean;
  needsChoice: boolean; // varietes ou options : il faut choisir sur la fiche
  ratingAvg: number;
  ratingCount: number;
  href?: string; // lien (par defaut : la fiche produit)
  matched?: string; // variete trouvee par la recherche
}

export default function ProductCard({ p, index = 0 }: { p: ProductCardData; index?: number }) {
  const out = !p.available;
  const href = p.href ?? `/produit/${p.slug}`;
  // Petit decalage d'apparition (animation) pour les premieres cartes.
  const style = { animationDelay: `${Math.min(index, 11) * 45}ms` } as React.CSSProperties;
  return (
    <div className="card pcard" style={style}>
      <a href={href} className="card-link">
        <div className="thumb">
          {p.featured && <span className="chip gold">Coup de cœur</span>}
          {p.imageData ? <img src={p.imageData} alt={p.name} loading="lazy" /> : <div className="ph">Photo à venir</div>}
        </div>
        <div className="card-body">
          <div className="card-cat">{p.category}</div>
          <div className="card-name">{p.name}</div>
          {p.matched && <div className="card-variant">Variété : {p.matched}</div>}
          <Stars avg={p.ratingAvg} count={p.ratingCount} size={13} />
          <div className="card-foot">
            <div className="price">{formatFcfa(p.price)}</div>
            {out ? <span className="stock-out">Rupture</span> : null}
          </div>
        </div>
      </a>
      <QuickAdd
        id={p.id}
        slug={p.slug}
        name={p.name}
        price={p.price}
        image={p.imageData}
        href={href}
        needsChoice={p.needsChoice}
        available={p.available}
      />
    </div>
  );
}
