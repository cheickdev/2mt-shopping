import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // On n'indexe pas les espaces prives ni l'API.
        disallow: ["/admin", "/reseller", "/account", "/api/", "/order/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
