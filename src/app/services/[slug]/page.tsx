import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/pricing";
import { paymentMode } from "@/lib/stripe";
import { currentCustomer } from "@/lib/customer-auth";
import OrderForm, { ServiceOption } from "../../OrderForm";

export const dynamic = "force-dynamic";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = await prisma.service.findUnique({ where: { slug } });
  if (!service) return { title: "Service introuvable | UnlockPro" };

  // Le template du layout racine ajoute deja " | UnlockPro" au titre.
  const title = `${service.name} par IMEI`;
  const description = `${service.description} Resultat ${service.estimatedTime.toLowerCase()}, par IMEI, en ligne.`;
  const url = `${siteUrl()}/services/${service.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | UnlockPro`, description, url, type: "website", siteName: "UnlockPro" },
    twitter: { card: "summary", title: `${title} | UnlockPro`, description },
  };
}

const CHECK_FAQ = [
  { q: "Qu'est-ce que l'IMEI et comment l'obtenir ?", a: "L'IMEI est l'identifiant unique a 15 chiffres de votre telephone. Composez *#06# pour l'afficher." },
  { q: "Combien de temps pour recevoir le resultat ?", a: "La plupart des verifications sont instantanees. Le resultat s'affiche et vous est envoye par email." },
  { q: "Est-ce fiable ?", a: "Les donnees proviennent des bases officielles des operateurs et fabricants, interrogees en temps reel." },
];
const UNLOCK_FAQ = [
  { q: "Le deblocage est-il definitif ?", a: "Oui. Une fois debloque par IMEI, l'appareil reste debloque, meme apres une mise a jour ou une reinitialisation." },
  { q: "Ai-je besoin d'ouvrir le telephone ?", a: "Non. Le deblocage se fait a distance par IMEI, sans manipulation materielle ni perte de garantie." },
  { q: "Comment obtenir mon IMEI ?", a: "Composez *#06# sur le telephone pour afficher les 15 chiffres de l'IMEI." },
];

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await prisma.service.findUnique({ where: { slug } });
  if (!service || !service.active) notFound();

  const [related, customer] = await Promise.all([
    prisma.service.findMany({
      where: { active: true, type: service.type, slug: { not: service.slug } },
      take: 3,
    }),
    currentCustomer(),
  ]);

  const isUnlock = service.type === "UNLOCK";
  const faq = isUnlock ? UNLOCK_FAQ : CHECK_FAQ;
  const option: ServiceOption = {
    slug: service.slug,
    name: service.name,
    priceLabel: formatMoney(service.priceCents, service.currency),
  };

  // Donnees structurees (rich results Google).
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: service.name,
        description: service.description,
        provider: { "@type": "Organization", name: "UnlockPro" },
        areaServed: "Worldwide",
        offers: {
          "@type": "Offer",
          price: (service.priceCents / 100).toFixed(2),
          priceCurrency: service.currency,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav style={{ fontSize: 13, color: "var(--muted)", marginTop: 20 }}>
        <a href="/">Accueil</a> › <span>{service.name}</span>
      </nav>

      <section className="hero" style={{ paddingTop: 28 }}>
        <div className="badge">{isUnlock ? "Deblocage reseau" : "Verification IMEI"} · {service.estimatedTime}</div>
        <h1>{service.name}</h1>
        <p>{service.description}</p>
        <div style={{ fontSize: 28, fontWeight: 800, marginTop: 12 }}>{formatMoney(service.priceCents, service.currency)}</div>
      </section>

      <OrderForm services={[option]} paymentLive={paymentMode() === "live"} defaultEmail={customer?.email ?? ""} />

      <h2 className="section-title">Comment ca marche</h2>
      <div className="grid">
        <div className="card"><div className="type">Etape 1</div><h3>Saisissez l&apos;IMEI</h3><div className="desc">Composez *#06# sur le telephone et copiez les 15 chiffres.</div></div>
        <div className="card"><div className="type">Etape 2</div><h3>Payez en ligne</h3><div className="desc">Paiement securise. Aucune donnee bancaire conservee.</div></div>
        <div className="card"><div className="type">Etape 3</div><h3>Recevez le resultat</h3><div className="desc">{isUnlock ? "Votre code et les instructions" : "Votre rapport"} par email et sur votre suivi de commande.</div></div>
      </div>

      <h2 className="section-title">Questions frequentes</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {faq.map((f) => (
          <div className="card" key={f.q}>
            <h3 style={{ margin: "0 0 6px" }}>{f.q}</h3>
            <div className="desc">{f.a}</div>
          </div>
        ))}
      </div>

      {related.length > 0 && (
        <>
          <h2 className="section-title">Autres services</h2>
          <div className="grid">
            {related.map((r) => (
              <a key={r.id} href={`/services/${r.slug}`} className="card svc" style={{ color: "inherit" }}>
                <div className="type">{r.type === "UNLOCK" ? "Deblocage" : "Verification"}</div>
                <h3>{r.name}</h3>
                <div className="desc">{r.description}</div>
                <div className="foot"><div className="price">{formatMoney(r.priceCents, r.currency)}</div><div className="time">{r.estimatedTime}</div></div>
              </a>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
