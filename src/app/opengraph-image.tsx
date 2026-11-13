import { ImageResponse } from "next/og";
import { publicProductWhere } from "@/lib/vendors";
import { prisma } from "@/lib/db";
import { ACCENT, Brand, OG_SIZE, photoForOg } from "@/lib/og";

// Vignette de la boutique (lien de l'accueil partage sur WhatsApp, Facebook…) :
// nom de la boutique, slogan et 3 produits « Coup de coeur ».
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "2MT - Shopping, livraison à Bamako";
export const revalidate = 3600;

export default async function Image() {
  const rows = await prisma.product
    .findMany({
      where: { ...publicProductWhere, vendorId: null, imageData: { not: null } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: { imageData: true },
    })
    .catch(() => []);
  const photos = (await Promise.all(rows.map((r) => photoForOg(r.imageData, 300)))).filter((x): x is string => !!x);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fbf7f6", padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Brand size={64} />
          <div style={{ display: "flex", fontSize: 44, color: "#231a1f", marginTop: 18, fontWeight: 700 }}>La boutique qui vous livre chez vous</div>
          <div style={{ display: "flex", fontSize: 30, color: "#4a3d44", marginTop: 10 }}>Parfums, soins du corps, cosmétiques · Paiement à la livraison</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex" }}>
            {photos.map((src, i) => (
              <div key={i} style={{ display: "flex", width: 230, height: 230, marginRight: 20, background: "#fff", borderRadius: 24, border: "2px solid #ece0db", alignItems: "center", justifyContent: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} width={200} height={200} alt="" style={{ objectFit: "contain" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", background: ACCENT, color: "#fff", fontSize: 36, fontWeight: 700, borderRadius: 18, padding: "14px 28px" }}>www.2mt.shop</div>
        </div>
      </div>
    ),
    size
  );
}
