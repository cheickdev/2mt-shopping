import { formatFcfa } from "@/lib/money";

export interface CarouselItem {
  slug: string;
  name: string;
  price: number;
  image: string;
}

// Bandeau de produits qui defile tout seul dans la banniere d'accueil.
// Animation en CSS pur (la liste est doublee pour boucler sans saut) ;
// elle s'arrete au survol, et pour les personnes qui reduisent les animations.
export default function HeroCarousel({ items }: { items: CarouselItem[] }) {
  if (items.length < 2) return null;
  const loop = [...items, ...items];
  const duration = Math.max(18, items.length * 4); // secondes pour un tour
  return (
    <div className="marquee" aria-label="Produits à découvrir">
      <div className="marquee-track" style={{ animationDuration: `${duration}s` }}>
        {loop.map((it, i) => (
          <a
            key={i}
            href={`/produit/${it.slug}`}
            className="marquee-item"
            aria-hidden={i >= items.length ? true : undefined}
            tabIndex={i >= items.length ? -1 : undefined}
          >
            <span className="marquee-img">
              <img src={it.image} alt={i >= items.length ? "" : it.name} loading={i < 4 ? "eager" : "lazy"} />
            </span>
            <span className="marquee-name">{it.name}</span>
            <span className="marquee-price">{formatFcfa(it.price)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
