import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { publicProductWhere } from "@/lib/vendors";
import { cardSelect, imageVersions, toCard } from "@/lib/product-cards";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return prisma.vendor.findFirst({ where: { slug, active: true } }).catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const v = await load((await params).slug);
  if (!v) return { title: "Vendeur introuvable" };
  return {
    title: `${v.name} — boutique`,
    description: v.description || `Les articles de ${v.name} sur 2MT - Shopping, à Bamako.`,
    alternates: { canonical: `/vendeur/${v.slug}` },
  };
}

// Page publique d'un vendeur partenaire : ses produits valides + son WhatsApp.
export default async function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const v = await load((await params).slug);
  if (!v) notFound();
  const rows = await prisma.product.findMany({
    where: { ...publicProductWhere, vendorId: v.id },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    select: cardSelect,
  });
  const versions = await imageVersions(rows.map((p) => p.id));
  const wa = `https://wa.me/${v.whatsapp}?text=${encodeURIComponent(`Bonjour ${v.name} 👋\nJ'ai vu votre boutique sur 2mt.shop.`)}`;
  return (
    <>
      <div className="vendor-hero">
        <div className="vendor-avatar" aria-hidden>{v.name.slice(0, 1).toUpperCase()}</div>
        <div className="vendor-hero-info">
          <h1 style={{ margin: 0 }}>{v.name}</h1>
          <div className="note">Vendeur partenaire · {rows.length} article{rows.length > 1 ? "s" : ""}</div>
          {v.description && <p className="desc" style={{ margin: "6px 0 0" }}>{v.description}</p>}
        </div>
        <a className="btn wa" href={wa} target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp</a>
      </div>
      {rows.length === 0 ? (
        <p className="note">Aucun article pour le moment.</p>
      ) : (
        <div className="grid">
          {rows.map((p, i) => (
            <ProductCard key={p.id} p={toCard(p, versions)} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
