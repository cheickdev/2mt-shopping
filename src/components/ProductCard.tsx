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
  vendor?: { name: string; slug: string; whatsapp: string } | null; // produit d'un vendeur partenaire
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
          {p.vendor && <div className="card-vendor">Vendu par {p.vendor.name}</div>}
          <Stars avg={p.ratingAvg} count={p.ratingCount} size={13} />
          <div className="card-foot">
            <div className="price">{formatFcfa(p.price)}</div>
            {out ? <span className="stock-out">Rupture</span> : null}
          </div>
        </div>
      </a>
      {p.vendor ? (
        !out && (
          <a
            className="quick-add quick-wa"
            href={`https://wa.me/${p.vendor.whatsapp}?text=${encodeURIComponent(`Bonjour ${p.vendor.name} 👋\nJ'ai vu sur 2mt.shop : ${p.name} — ${formatFcfa(p.price)}. Est-ce disponible ?`)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Commander ${p.name} sur WhatsApp auprès de ${p.vendor.name}`}
            title="Commander sur WhatsApp"
          >
            <WaIcon />
          </a>
        )
      ) : (
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
      )}
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
