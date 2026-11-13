import { redirect } from "next/navigation";
import { currentRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { dayOf } from "@/lib/visits";
import { imageUrl, imageVersions } from "@/lib/product-cards";
import AdminShell from "../AdminShell";
import VisitChart from "@/components/admin/VisitChart";

export const dynamic = "force-dynamic";

const PERIODS = [
  { d: 1, label: "Aujourd'hui" },
  { d: 7, label: "7 jours" },
  { d: 30, label: "30 jours" },
  { d: 90, label: "3 mois" },
];

const n = (x: unknown) => Number(x ?? 0);
const fmt = (x: number) => x.toLocaleString("fr-FR");

export default async function AdminStats({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  const settings = await getSettings();
  const userName = role === "owner" ? settings.ownerName : settings.partnerName;

  const { p: period } = await searchParams;
  const days = PERIODS.find((x) => String(x.d) === period)?.d ?? 7;
  const from = dayOf(new Date(Date.now() - (days - 1) * 86400_000));
  const fromDate = new Date(from + "T00:00:00Z");
  // Periode precedente de meme duree (pour comparer).
  const prevFrom = dayOf(new Date(Date.now() - (2 * days - 1) * 86400_000));

  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [daily, totalsRows, prevRows, sources, devices, top, now] = await Promise.all([
    safe(prisma.$queryRaw<{ day: string; visitors: bigint; views: bigint }[]>`
      SELECT "day", COUNT(*) AS visitors, SUM("views") AS views FROM "SiteVisit" WHERE "day" >= ${from} GROUP BY "day" ORDER BY "day"`, []),
    safe(prisma.$queryRaw<{ visitors: bigint; views: bigint; newcomers: bigint }[]>`
      SELECT COUNT(DISTINCT "visitor") AS visitors, COALESCE(SUM("views"), 0) AS views,
        COUNT(DISTINCT "visitor") FILTER (WHERE "visitor" NOT IN (SELECT "visitor" FROM "SiteVisit" WHERE "day" < ${from})) AS newcomers
      FROM "SiteVisit" WHERE "day" >= ${from}`, []),
    safe(prisma.$queryRaw<{ visitors: bigint }[]>`
      SELECT COUNT(DISTINCT "visitor") AS visitors FROM "SiteVisit" WHERE "day" >= ${prevFrom} AND "day" < ${from}`, []),
    safe(prisma.$queryRaw<{ source: string; visitors: bigint }[]>`
      SELECT "source", COUNT(DISTINCT "visitor") AS visitors FROM "SiteVisit" WHERE "day" >= ${from} GROUP BY "source" ORDER BY visitors DESC LIMIT 8`, []),
    safe(prisma.$queryRaw<{ mobile: boolean; visitors: bigint }[]>`
      SELECT "mobile", COUNT(DISTINCT "visitor") AS visitors FROM "SiteVisit" WHERE "day" >= ${from} GROUP BY "mobile"`, []),
    safe(prisma.$queryRaw<{ productId: string; views: bigint; visitors: bigint }[]>`
      SELECT "productId", SUM("views") AS views, COUNT(DISTINCT "visitor") AS visitors FROM "ProductVisit"
      WHERE "day" >= ${from} GROUP BY "productId" ORDER BY visitors DESC, views DESC LIMIT 30`, []),
    safe(prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM "SiteVisit" WHERE "day" = ${dayOf()} AND "firstAt" > NOW() - INTERVAL '30 minutes'`, []),
  ]);

  const ids = top.map((t) => t.productId);
  const [products, ordered, versions, productViews] = await Promise.all([
    ids.length ? prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true, price: true, vendor: { select: { name: true } } } }) : [],
    ids.length
      ? prisma.orderItem.groupBy({
          by: ["productId"],
          where: { productId: { in: ids }, order: { createdAt: { gte: fromDate }, status: { not: "ANNULEE" } } },
          _sum: { quantity: true },
        })
      : [],
    imageVersions(ids),
    safe(prisma.$queryRaw<{ c: bigint }[]>`SELECT COALESCE(SUM("views"), 0) AS c FROM "ProductVisit" WHERE "day" >= ${from}`, []),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const orderedBy = new Map(ordered.map((o) => [o.productId, o._sum.quantity ?? 0]));

  // Tous les jours de la periode, meme sans visite.
  const dayMap = new Map(daily.map((d) => [d.day, { visitors: n(d.visitors), views: n(d.views) }]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = dayOf(new Date(fromDate.getTime() + i * 86400_000));
    return { day, ...(dayMap.get(day) ?? { visitors: 0, views: 0 }) };
  });

  const visitors = n(totalsRows[0]?.visitors);
  const views = n(totalsRows[0]?.views);
  const newcomers = n(totalsRows[0]?.newcomers);
  const prev = n(prevRows[0]?.visitors);
  const trend = prev > 0 ? Math.round(((visitors - prev) / prev) * 100) : null;
  const mobile = n(devices.find((d) => d.mobile)?.visitors);
  const desktop = n(devices.find((d) => !d.mobile)?.visitors);
  const sourceTotal = sources.reduce((s, x) => s + n(x.visitors), 0) || 1;

  return (
    <AdminShell owner={role === "owner"} userName={userName}>
      <h1>Statistiques</h1>
      <p className="note" style={{ marginTop: 0 }}>
        Visiteurs du site et produits regardés. Vos propres visites (connecté à l'administration) ne sont pas comptées.
      </p>

      <div className="st-periods" role="tablist">
        {PERIODS.map((x) => (
          <a key={x.d} href={`/admin/statistiques?p=${x.d}`} className={`st-period ${x.d === days ? "on" : ""}`} role="tab" aria-selected={x.d === days}>
            {x.label}
          </a>
        ))}
      </div>

      <div className="st-tiles">
        <div className="st-tile">
          <div className="st-label">Visiteurs</div>
          <div className="st-value">{fmt(visitors)}</div>
          <div className="st-sub">
            {trend === null ? "—" : `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend)} % vs période précédente`}
          </div>
        </div>
        <div className="st-tile">
          <div className="st-label">Nouveaux visiteurs</div>
          <div className="st-value">{fmt(newcomers)}</div>
          <div className="st-sub">{fmt(Math.max(0, visitors - newcomers))} déjà venus avant</div>
        </div>
        <div className="st-tile">
          <div className="st-label">Pages vues</div>
          <div className="st-value">{fmt(views)}</div>
          <div className="st-sub">{visitors ? (views / visitors).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : 0} par visiteur</div>
        </div>
        <div className="st-tile">
          <div className="st-label">Produits regardés</div>
          <div className="st-value">{fmt(n(productViews[0]?.c))}</div>
          <div className="st-sub">🟢 {fmt(n(now[0]?.c))} arrivé(s) ces 30 dernières min.</div>
        </div>
      </div>

      {days > 1 && (
        <section className="st-card">
          <h2>Visiteurs par jour</h2>
          <VisitChart series={series} />
        </section>
      )}

      <div className="st-two">
        <section className="st-card">
          <h2>D'où viennent les visiteurs</h2>
          {sources.length === 0 ? (
            <p className="note">Pas encore de données.</p>
          ) : (
            <div className="st-bars">
              {sources.map((s) => {
                const pct = Math.round((n(s.visitors) / sourceTotal) * 100);
                return (
                  <div key={s.source} className="st-bar-row">
                    <div className="st-bar-head">
                      <span>{s.source || "Direct"}</span>
                      <span>{fmt(n(s.visitors))} · {pct} %</span>
                    </div>
                    <div className="st-bar-track"><div className="st-bar-fill" style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="note" style={{ marginBottom: 0 }}>« Direct » : lien tapé, favori, ou application qui ne dit pas d'où vient le visiteur.</p>
        </section>
        <section className="st-card">
          <h2>Appareils</h2>
          <div className="st-bars">
            {[
              { label: "📱 Téléphone", v: mobile },
              { label: "💻 Ordinateur", v: desktop },
            ].map((x) => {
              const pct = mobile + desktop ? Math.round((x.v / (mobile + desktop)) * 100) : 0;
              return (
                <div key={x.label} className="st-bar-row">
                  <div className="st-bar-head"><span>{x.label}</span><span>{fmt(x.v)} · {pct} %</span></div>
                  <div className="st-bar-track"><div className="st-bar-fill" style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="st-card">
        <h2>Produits les plus regardés</h2>
        {top.length === 0 ? (
          <p className="note">Aucun produit regardé sur cette période.</p>
        ) : (
          <div className="table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produit</th>
                  <th className="num">Visiteurs</th>
                  <th className="num">Vues</th>
                  <th className="num">Commandés</th>
                </tr>
              </thead>
              <tbody>
                {top.map((t, i) => {
                  const p = byId.get(t.productId);
                  if (!p) return null;
                  const img = imageUrl(p.id, versions);
                  const qty = orderedBy.get(p.id) ?? 0;
                  return (
                    <tr key={t.productId}>
                      <td className="muted">{i + 1}</td>
                      <td>
                        <a href={`/produit/${p.slug}`} target="_blank" rel="noopener noreferrer" className="st-prod">
                          <span className="st-prod-img">{img ? <img src={img} alt="" loading="lazy" /> : null}</span>
                          <span>
                            {p.name}
                            {p.vendor && <span className="note"> · {p.vendor.name}</span>}
                          </span>
                        </a>
                      </td>
                      <td className="num"><b>{fmt(n(t.visitors))}</b></td>
                      <td className="num">{fmt(n(t.views))}</td>
                      <td className="num">{p.vendor ? <span className="muted">WhatsApp</span> : qty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="note" style={{ marginBottom: 0 }}>
          Astuce : un produit très regardé mais peu commandé ? Vérifiez son prix, ses photos ou sa description.
        </p>
      </section>
    </AdminShell>
  );
}
