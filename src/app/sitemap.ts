import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const services = await prisma.service.findMany({ where: { active: true }, select: { slug: true } });

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/api-docs`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/account/login`, changeFrequency: "monthly", priority: 0.3 },
    ...services.map((s) => ({
      url: `${base}/services/${s.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
