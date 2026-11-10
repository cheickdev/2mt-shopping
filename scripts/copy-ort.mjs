// Copie le moteur d'IA (onnxruntime-web, WebAssembly) dans public/ia/ort
// pour que l'outil « Enlever le fond » soit servi par notre propre site
// (pas de dependance a un CDN exterieur). Lance avant chaque `next build`.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules", "onnxruntime-web", "dist");
const dest = join(process.cwd(), "public", "ia", "ort");
// ".asyncify" : version pour WebGPU ; sans suffixe : version simple (tous navigateurs).
const files = ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"];

if (!existsSync(src)) {
  console.warn("[copy-ort] onnxruntime-web introuvable : outil « Enlever le fond » indisponible.");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const f of files) cpSync(join(src, f), join(dest, f));
console.log(`[copy-ort] ${files.length} fichiers copies dans public/ia/ort`);
