import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Photo principale d'un produit, servie comme une vraie image (au lieu d'etre
// copiee dans chaque page). Avec ?v=<empreinte>, le navigateur la garde en
// memoire : elle n'est telechargee qu'une fois.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.product.findUnique({ where: { id }, select: { imageData: true } });
  const m = p?.imageData ? /^data:([^;,]+);base64,(.*)$/s.exec(p.imageData) : null;
  if (!m) return new Response("Image introuvable", { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": m[1],
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
    },
  });
}
