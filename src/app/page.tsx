import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/pricing";
import { paymentMode } from "@/lib/stripe";
import { currentCustomer } from "@/lib/customer-auth";
import OrderForm, { ServiceOption } from "./OrderForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { priceCents: "asc" }],
  });

  const options: ServiceOption[] = services.map((s) => ({
    slug: s.slug,
    name: s.name,
    priceLabel: formatMoney(s.priceCents, s.currency),
  }));

  const checks = services.filter((s) => s.type === "CHECK");
  const unlocks = services.filter((s) => s.type === "UNLOCK");

  const customer = await currentCustomer();

  return (
    <main>
      <section className="hero">
        <div className="badge">Resultats rapides · Partout dans le monde</div>
        <h1>Verifiez et debloquez n'importe quel telephone par IMEI</h1>
        <p>
          Statut iCloud, blacklist, operateur d'origine, deblocage reseau definitif. Saisissez l'IMEI,
          recevez le resultat.
        </p>
      </section>

      {options.length > 0 ? (
        <OrderForm services={options} paymentLive={paymentMode() === "live"} defaultEmail={customer?.email ?? ""} />
      ) : (
        <div className="card form-card">
          <p>Aucun service charge. Lancez le seed : <code>npm run db:seed</code>.</p>
        </div>
      )}

      <h2 className="section-title">Verifications IMEI</h2>
      <p className="section-sub">Essentielles avant d'acheter un telephone d'occasion.</p>
      <div className="grid">
        {checks.map((s) => (
          <a key={s.id} href={`/services/${s.slug}`} className="card svc" style={{ color: "inherit" }}>
            <div className="type">Verification</div>
            <h3>{s.name}</h3>
            <div className="desc">{s.description}</div>
            <div className="foot">
              <div className="price">{formatMoney(s.priceCents, s.currency)}</div>
              <div className="time">{s.estimatedTime}</div>
            </div>
          </a>
        ))}
      </div>

      <h2 className="section-title">Deblocage reseau</h2>
      <p className="section-sub">Deblocage definitif par IMEI, compatible mises a jour.</p>
      <div className="grid">
        {unlocks.map((s) => (
          <a key={s.id} href={`/services/${s.slug}`} className="card svc" style={{ color: "inherit" }}>
            <div className="type">Deblocage</div>
            <h3>{s.name}</h3>
            <div className="desc">{s.description}</div>
            <div className="foot">
              <div className="price">{formatMoney(s.priceCents, s.currency)}</div>
              <div className="time">{s.estimatedTime}</div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
