// Statistiques de visite anonymes, hebergees sur le site (aucun service externe).
// Un visiteur = un identifiant aleatoire dans un cookie ; on ne garde ni nom,
// ni numero, ni adresse IP.

import { prisma } from "@/lib/db";

export const VISITOR_COOKIE = "2mt_vid";

/** Jour AAAA-MM-JJ a Bamako (UTC+0). */
export function dayOf(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|python|curl|wget|httpclient|monitor/i;
export function isBot(ua: string): boolean {
  return !ua || BOT.test(ua);
}

export function isMobile(ua: string): boolean {
  return /android|iphone|ipad|ipod|mobile|kaios|opera mini/i.test(ua);
}

/** D'ou vient le visiteur, d'apres la page precedente et les parametres du lien. */
export function sourceOf(referrer: string, search: string, siteHost: string): string {
  const q = new URLSearchParams(search);
  const utm = (q.get("utm_source") ?? "").toLowerCase();
  if (q.has("fbclid") || /facebook|fb|instagram|ig|meta/.test(utm)) return "Facebook / Instagram";
  if (/whatsapp|wa/.test(utm)) return "WhatsApp";
  if (/google/.test(utm) || q.has("gclid")) return "Google";
  if (utm) return utm.slice(0, 40);
  let host = "";
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : "";
  } catch {
    host = "";
  }
  if (!host || host === siteHost || host.endsWith(".vercel.app") || host.endsWith("2mt.shop")) return "Direct";
  if (/facebook|fb\.|instagram|messenger/.test(host)) return "Facebook / Instagram";
  if (/whatsapp|wa\.me/.test(host)) return "WhatsApp";
  if (/google\./.test(host)) return "Google";
  if (/bing|yahoo|duckduckgo|ecosia|qwant/.test(host)) return "Autres moteurs de recherche";
  if (/tiktok/.test(host)) return "TikTok";
  return host.replace(/^www\./, "").slice(0, 40);
}

/** Enregistre une page vue (et le produit regarde, s'il y en a un). */
export async function recordVisit(opts: { visitor: string; source: string; mobile: boolean; productId: string | null }) {
  const day = dayOf();
  await prisma.$executeRaw`
    INSERT INTO "SiteVisit" ("day", "visitor", "views", "source", "mobile")
    VALUES (${day}, ${opts.visitor}, 1, ${opts.source}, ${opts.mobile})
    ON CONFLICT ("day", "visitor") DO UPDATE SET "views" = "SiteVisit"."views" + 1`;
  if (opts.productId) {
    await prisma.$executeRaw`
      INSERT INTO "ProductVisit" ("day", "productId", "visitor", "views")
      VALUES (${day}, ${opts.productId}, ${opts.visitor}, 1)
      ON CONFLICT ("day", "productId", "visitor") DO UPDATE SET "views" = "ProductVisit"."views" + 1`;
  }
  // De temps en temps, on efface les statistiques de plus d'un an.
  if (Math.random() < 0.005) {
    const old = dayOf(new Date(Date.now() - 400 * 86400_000));
    await prisma.$executeRaw`DELETE FROM "SiteVisit" WHERE "day" < ${old}`;
    await prisma.$executeRaw`DELETE FROM "ProductVisit" WHERE "day" < ${old}`;
  }
}
