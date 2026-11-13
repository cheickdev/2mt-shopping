import { isAdmin } from "@/lib/admin-auth";
import { currentVendor } from "@/lib/vendors";
import { safeFetch } from "@/lib/safe-fetch";

export const dynamic = "force-dynamic";

// Relais d'image : le navigateur de l'admin ne peut pas lire directement les
// images d'un autre site (securite des navigateurs), on les passe donc par ici
// pour les redimensionner avant de les enregistrer.
export async function GET(req: Request) {
  if (!(await isAdmin()) && !(await currentVendor())) return new Response("Non autorisé.", { status: 401 });
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return new Response("Lien manquant.", { status: 400 });
  try {
    const img = await safeFetch(url, { accept: "image/avif,image/webp,image/*,*/*;q=0.8", maxBytes: 8_000_000 });
    if (!img.contentType.startsWith("image/")) return new Response("Ce n'est pas une image.", { status: 415 });
    return new Response(new Uint8Array(img.body), {
      headers: { "Content-Type": img.contentType, "Cache-Control": "private, max-age=600" },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }
}
