// Outil « Enlever le fond » : intelligence artificielle SAM 2 (Meta, licence
// Apache-2.0) qui tourne DANS le navigateur (telephone ou ordinateur).
// Aucun serveur payant : le modele (~33 Mo) est servi par notre site
// (public/ia/) et garde en memoire par le navigateur apres le 1er chargement.
//
// Fonctionnement : la photo est analysee une fois (encode), puis chaque cadre
// trace autour d'un produit donne un masque en une fraction de seconde.

/* eslint-disable @typescript-eslint/no-explicit-any */

const MODEL = "sam2-tiny-v1"; // dossier public/ia/sam2-tiny-v1
const MAX_SOURCE = 2048; // la photo est reduite a 2048 px max avant analyse
const MAX_OUT = 900; // taille max de la photo finale (carree)
const MAX_CHARS = 1_700_000; // limite du serveur : 1 800 000 caracteres

export type Box = [number, number, number, number]; // x0, y0, x1, y1 (px de la photo)
export type Progress = (pct: number | null, label: string) => void;

interface Engine {
  T: any;
  model: any;
  processor: any;
}

let engine: Promise<Engine> | null = null;

async function hasWebGpuF16(): Promise<boolean> {
  const gpu = (navigator as any).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return !!adapter && adapter.features.has("shader-f16");
  } catch {
    return false;
  }
}

async function loadEngine(onProgress?: Progress): Promise<Engine> {
  onProgress?.(null, "Préparation de l'outil…");
  const T: any = await import("@huggingface/transformers");
  const { env } = T;
  const base = `${location.origin}/ia/`;
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.remoteHost = base;
  env.remotePathTemplate = "{model}/";

  const gpu = await hasWebGpuF16();
  const setWasm = (suffix: string) => {
    env.backends.onnx.wasm.wasmPaths = {
      mjs: `${base}ort/ort-wasm-simd-threaded${suffix}.mjs`,
      wasm: `${base}ort/ort-wasm-simd-threaded${suffix}.wasm`,
    };
  };
  // WebGPU (rapide) demande la version « asyncify » du moteur ; sinon la version simple.
  setWasm(gpu ? ".asyncify" : "");

  // Progression du telechargement (tous fichiers confondus).
  const files: Record<string, { loaded: number; total: number }> = {};
  const progress_callback = (p: any) => {
    if (p.status === "progress" && p.file && p.total) {
      files[p.file] = { loaded: p.loaded, total: p.total };
      const all = Object.values(files);
      const loaded = all.reduce((s, f) => s + f.loaded, 0);
      const total = all.reduce((s, f) => s + f.total, 0);
      onProgress?.(Math.round((loaded / total) * 100), "Téléchargement de l'outil (une seule fois)…");
    }
  };

  const processor = await T.AutoProcessor.from_pretrained(MODEL);
  let model: any;
  try {
    model = await T.Sam2Model.from_pretrained(MODEL, { dtype: "q4f16", device: gpu ? "webgpu" : "wasm", progress_callback });
  } catch (e) {
    if (!gpu) throw e;
    // WebGPU a echoue : on reessaie avec le moteur simple.
    console.warn("WebGPU indisponible, passage au mode simple", e);
    setWasm("");
    model = await T.Sam2Model.from_pretrained(MODEL, { dtype: "q4f16", device: "wasm", progress_callback });
  }
  return { T, model, processor };
}

/** Charge l'IA (une seule fois par page). */
export function getEngine(onProgress?: Progress): Promise<Engine> {
  if (!engine) {
    engine = loadEngine(onProgress).catch((e) => {
      engine = null; // permet de reessayer
      throw e;
    });
  }
  return engine;
}

/** Photo analysee, prete a etre decoupee. */
export interface Prepared {
  canvas: HTMLCanvasElement; // la photo (reduite) en pixels
  width: number;
  height: number;
  image: any; // RawImage
  embeddings: Record<string, any>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Photo illisible."));
    img.src = src;
  });
}

/** Charge la photo et la fait analyser par l'IA (l'etape la plus longue). */
export async function preparePhoto(src: string, onProgress?: Progress): Promise<Prepared> {
  const { T, model, processor } = await getEngine(onProgress);
  onProgress?.(null, "Analyse de la photo…");
  const img = await loadImage(src);
  let { naturalWidth: w, naturalHeight: h } = img;
  const k = Math.min(1, MAX_SOURCE / Math.max(w, h));
  w = Math.round(w * k);
  h = Math.round(h * k);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Navigateur trop ancien.");
  ctx.fillStyle = "#fff"; // fond blanc sous une eventuelle photo deja transparente
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const image = T.RawImage.fromCanvas(canvas);
  const inputs = await processor(image);
  const embeddings = await model.get_image_embeddings(inputs);
  return { canvas, width: w, height: h, image, embeddings };
}

/** Resultat du decoupage : masque net (1 = produit) + transparence douce (0..1) pour des bords lisses. */
export interface Cut {
  mask: Uint8Array;
  soft: Float32Array;
}

/** Decoupe le produit encadre par `box`. */
export async function segment(prep: Prepared, box: Box): Promise<Cut> {
  const { model, processor } = await getEngine();
  const inputs = await processor(prep.image, { input_boxes: [[box]] });
  const out = await model({ ...inputs, ...prep.embeddings });
  // binarize: false -> on recupere les « scores » de l'IA, pas seulement oui/non.
  const masks = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes, { binarize: false });
  const scores: ArrayLike<number> = out.iou_scores.data;
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  const m = masks[0]; // [1, n, H, W]
  const H = m.dims[2];
  const W = m.dims[3];
  const data = m.data as ArrayLike<number>;
  const off = best * H * W;
  const mask = new Uint8Array(W * H);
  const soft = new Float32Array(W * H);
  // On ne garde que ce qui est dans le cadre (+ petite marge).
  const mx = Math.round((box[2] - box[0]) * 0.03);
  const my = Math.round((box[3] - box[1]) * 0.03);
  const x0 = Math.max(0, Math.floor(box[0]) - mx);
  const y0 = Math.max(0, Math.floor(box[1]) - my);
  const x1 = Math.min(W, Math.ceil(box[2]) + mx);
  const y1 = Math.min(H, Math.ceil(box[3]) + my);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = y * W + x;
      const logit = data[off + i];
      soft[i] = 1 / (1 + Math.exp(-logit));
      if (logit > 0) mask[i] = 1;
    }
  return { mask: cleanMask(mask, W, H), soft };
}

/** Garde le plus gros morceau et bouche les trous (etiquettes, reflets). */
function cleanMask(mask: Uint8Array, W: number, H: number): Uint8Array {
  const label = new Int32Array(W * H);
  const stack = new Int32Array(W * H);
  let bestId = 0;
  let bestSize = 0;
  let id = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || label[i]) continue;
    id++;
    let size = 0;
    let sp = 0;
    stack[sp++] = i;
    label[i] = id;
    while (sp) {
      const p = stack[--sp];
      size++;
      const x = p % W;
      const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W];
      for (const q of nb) {
        if (q >= 0 && q < W * H && mask[q] && !label[q]) {
          label[q] = id;
          stack[sp++] = q;
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
  }
  const out = new Uint8Array(W * H);
  if (!bestId) return out;
  // Fond = ce qui est hors du produit ET touche le bord de la photo.
  const outside = new Uint8Array(W * H);
  let sp = 0;
  const push = (p: number) => {
    if (label[p] !== bestId && !outside[p]) {
      outside[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < W; x++) {
    push(x);
    push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    push(y * W);
    push(y * W + W - 1);
  }
  while (sp) {
    const p = stack[--sp];
    const x = p % W;
    if (x > 0) push(p - 1);
    if (x < W - 1) push(p + 1);
    if (p >= W) push(p - W);
    if (p < W * (H - 1)) push(p + W);
  }
  for (let i = 0; i < W * H; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

/**
 * Fabrique la photo finale : le produit seul, fond transparent, centre dans
 * un carre avec une petite marge. WebP (leger) si possible, sinon PNG.
 */
export function composeCutout(prep: Prepared, cut: Cut): string | null {
  const { width: W, height: H } = prep;
  const { mask, soft } = cut;
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (mask[y * W + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;

  // Produit detoure, a la taille d'origine. Transparence :
  // - dans le produit : opaque (trous bouches compris), bord adouci par le score de l'IA ;
  // - juste autour (2 px) : bord doux ; plus loin : transparent (autres produits exclus).
  const pad = 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad);
  y1 = Math.min(H - 1, y1 + pad);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const near = (x: number, y: number) => {
    for (let dy = -pad; dy <= pad; dy++)
      for (let dx = -pad; dx <= pad; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && mask[yy * W + xx]) return true;
      }
    return false;
  };
  const src = prep.canvas.getContext("2d", { willReadFrequently: true })!.getImageData(x0, y0, bw, bh);
  const px = src.data;
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const i = (y0 + y) * W + (x0 + x);
      let a = 0;
      if (mask[i]) a = soft[i] >= 0.5 ? soft[i] : 1;
      else if (soft[i] > 0.02 && near(x0 + x, y0 + y)) a = soft[i];
      px[(y * bw + x) * 4 + 3] = Math.round(a * 255);
    }
  const piece = document.createElement("canvas");
  piece.width = bw;
  piece.height = bh;
  piece.getContext("2d")!.putImageData(src, 0, 0);

  let size = Math.min(MAX_OUT, Math.round(Math.max(bw, bh) * 1.08));
  for (let attempt = 0; attempt < 5; attempt++) {
    const out = document.createElement("canvas");
    out.width = size;
    out.height = size;
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    const k = (size / 1.08) / Math.max(bw, bh);
    const dw = bw * k;
    const dh = bh * k;
    ctx.drawImage(piece, (size - dw) / 2, (size - dh) / 2, dw, dh);
    let url = out.toDataURL("image/webp", 0.9);
    if (!url.startsWith("data:image/webp")) url = out.toDataURL("image/png");
    if (url.length <= MAX_CHARS) return url;
    size = Math.round(size * 0.8); // trop lourde : on reduit
  }
  return null;
}
