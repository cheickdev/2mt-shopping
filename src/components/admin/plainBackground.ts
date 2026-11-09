// Detection d'un fond uni (blanc ou autre couleur) sur une photo de produit :
// on regarde le pourtour de l'image ; s'il est presque partout de la meme
// couleur, le fond est considere comme uni.

export interface Background {
  plain: boolean;
  color: string; // couleur moyenne du pourtour, ex. "rgb(250,250,250)"
}

const SIZE = 64; // l'image est reduite a 64x64 pour l'analyse
const BAND = 3; // epaisseur du pourtour analyse (px)
const TOLERANCE = 28; // ecart de couleur accepte
const MIN_SHARE = 0.9; // part du pourtour qui doit etre de la couleur du fond

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Analyse une image (elle doit venir du meme site, ex. via le relais). */
export async function detectBackground(src: string): Promise<Background> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { plain: false, color: "" };
  // Fond blanc sous les images transparentes (PNG detoures).
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const px: [number, number, number][] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (x >= BAND && x < SIZE - BAND && y >= BAND && y < SIZE - BAND) continue;
      const i = (y * SIZE + x) * 4;
      px.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  // Couleur du fond = mediane de chaque canal (resiste aux quelques pixels du produit).
  const med = (k: 0 | 1 | 2) => px.map((p) => p[k]).sort((a, b) => a - b)[px.length >> 1];
  const bg: [number, number, number] = [med(0), med(1), med(2)];
  const close = px.filter(
    (p) => Math.abs(p[0] - bg[0]) <= TOLERANCE && Math.abs(p[1] - bg[1]) <= TOLERANCE && Math.abs(p[2] - bg[2]) <= TOLERANCE
  ).length;
  return { plain: close / px.length >= MIN_SHARE, color: `rgb(${bg.join(",")})` };
}
