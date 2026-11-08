import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/money";
import AddToCart, { AddToCartProduct } from "@/components/AddToCart";

export const dynamic = "force-dynamic";

const CAT_LABEL: Record<string, string> = { CHAUSSURES: "Chaussures", COSMETIQUES: "Cosmétiques" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.product.findUnique({ where: { slug } });
  if (!p) return { title: "Article introuvable" };
  return {
    title: p.name,
    description: p.description || `${p.name} — ${formatFcfa(p.price)}. Livraison à Bamako.`,
  };
}

function parseSizes(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await prisma.product.findUnique({ where: { slug } });
  if (!p || !p.active) notFound();

  const settings = await getSettings();
  const product: AddToCartProduct = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    image: p.imageData,
    sizes: parseSizes(p.sizes),
    stock: p.stock,
  };

  return (
    <>
      <nav className="note" style={{ marginTop: 16 }}>
        <a href="/" style={{ textDecoration: "none", color: "var(--muted)" }}>Accueil</a>
        {" › "}
        <a href={`/?cat=${p.category}`} style={{ textDecoration: "none", color: "var(--muted)" }}>
          {CAT_LABEL[p.category] ?? p.category}
        </a>
        {" › "}
        <span>{p.name}</span>
      </nav>

      <div className="product">
        <div className="gallery">
          {p.imageData ? <img src={p.imageData} alt={p.name} /> : <div className="ph">Photo à venir</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card-cat">{CAT_LABEL[p.category] ?? p.category}</div>
          <h1>{p.name}</h1>
          <div className="p-price">{formatFcfa(p.price)}</div>
          {p.description && <p className="desc">{p.description}</p>}
          <AddToCart product={product} whatsapp={settings.whatsapp} />
          <p className="note">
            🛵 Livraison à Bamako · 💵 Paiement à la livraison · Frais : {formatFcfa(settings.deliveryFee)}
          </p>
        </div>
      </div>
    </>
  );
}
