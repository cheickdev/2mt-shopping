import type { MetadataRoute } from "next";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.2mt.shop").replace(/\/$/, "");

// Robots (Google…) : tout le site, sauf l'admin et les adresses techniques.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/api/image/"], disallow: ["/admin", "/api/", "/panier", "/commande/"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
