// Redimensionne une photo cote navigateur -> Data URL JPEG legere (base64).
// Garde les images petites pour ne pas gonfler la base.
export async function fileToDataUrl(file: File, maxDim = 900, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  let { width, height } = img;
  if (width > height && width > maxDim) {
    height = Math.round((height * maxDim) / width);
    width = maxDim;
  } else if (height > maxDim) {
    width = Math.round((width * maxDim) / height);
    height = maxDim;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  // Photo sans fond (PNG/WebP transparent) : on garde la transparence.
  // (En JPEG, le fond transparent deviendrait noir.)
  if (hasTransparency(ctx, width, height)) {
    const webp = canvas.toDataURL("image/webp", 0.9);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  }
  return canvas.toDataURL("image/jpeg", quality);
}

/** Vrai si une partie de l'image est transparente. */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

/** Recupere une image d'un autre site via le relais du serveur, puis la reduit. */
export async function remoteToDataUrl(url: string): Promise<string> {
  const res = await fetch(`/api/admin/import/image?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  return fileToDataUrl(new File([blob], "image", { type: blob.type }));
}
