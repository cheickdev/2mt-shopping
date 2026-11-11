import sharp from "sharp";

// Outils communs aux vignettes de partage (WhatsApp, Facebook…).
export const OG_SIZE = { width: 1200, height: 630 };
export const ACCENT = "#b11f5c";
export const GOLD = "#c08a2d";

/**
 * Photo produit (Data URL, souvent WebP) -> PNG carre sur fond blanc,
 * format que le generateur de vignettes sait lire.
 */
export async function photoForOg(dataUrl: string | null | undefined, size = 540): Promise<string | null> {
  const m = dataUrl ? /^data:[^;,]+;base64,(.*)$/s.exec(dataUrl) : null;
  if (!m) return null;
  try {
    const png = await sharp(Buffer.from(m[1], "base64"))
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Bandeau « 2MT - Shopping » commun. */
export function Brand({ size = 34 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: size, fontWeight: 700 }}>
      <span style={{ color: ACCENT }}>2MT</span>
      <span style={{ color: GOLD, marginLeft: 10 }}>- Shopping</span>
    </div>
  );
}
