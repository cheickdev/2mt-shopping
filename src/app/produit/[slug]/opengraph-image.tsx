import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { publicProductWhere } from "@/lib/vendors";
import { formatFcfa } from "@/lib/money";
import { ACCENT, Brand, OG_SIZE, photoForOg } from "@/lib/og";

// Vignette affichee quand on partage le lien d'un produit (WhatsApp, Facebook…) :
// photo du produit + nom + prix + « 2MT - Shopping ».
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Produit 2MT - Shopping";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await prisma.product
    .findFirst({ where: { ...publicProductWhere, slug }, select: { name: true, price: true, category: true, imageData: true } })
    .catch(() => null);
  const photo = await photoForOg(p?.imageData);
  const name = p?.name ?? "2MT - Shopping";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fbf7f6", padding: 40, fontFamily: "sans-serif" }}>
        <div
          style={{
            width: 550,
            height: 550,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            borderRadius: 32,
            border: "2px solid #ece0db",
            flexShrink: 0,
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={500} height={500} alt="" style={{ objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", fontSize: 40, color: "#7a6c73" }}>Photo à venir</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", marginLeft: 48, flex: 1, paddingTop: 10, paddingBottom: 10 }}>
          <Brand />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {p?.category && <div style={{ display: "flex", fontSize: 26, color: "#7a6c73", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>{p.category}</div>}
            <div style={{ display: "flex", fontSize: name.length > 40 ? 46 : 56, fontWeight: 700, color: "#231a1f", lineHeight: 1.15 }}>{name}</div>
            {p && (
              <div style={{ display: "flex", marginTop: 26 }}>
                <div style={{ display: "flex", background: ACCENT, color: "#fff", fontSize: 50, fontWeight: 700, borderRadius: 18, padding: "10px 26px" }}>
                  {formatFcfa(p.price)}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 26, color: "#4a3d44" }}>
            <div style={{ display: "flex" }}>Livraison à Bamako · Paiement à la livraison</div>
            <div style={{ display: "flex", color: ACCENT, marginTop: 6, fontWeight: 700 }}>www.2mt.shop</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
