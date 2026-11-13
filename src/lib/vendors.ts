// Espace vendeurs : visibilite des produits et connexion des vendeurs.
//
// Un vendeur a son propre mot de passe (hash scrypt) et son propre cookie,
// distinct de l'administration : il ne voit et ne modifie que SES produits.

import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword, safeEqual, sessionSecret, verifyHash } from "@/lib/admin-auth";

/**
 * Produits visibles par les clients : actifs, non archives, valides, et soit
 * de 2MT, soit d'un vendeur non suspendu. A utiliser dans TOUTES les pages publiques.
 */
export const publicProductWhere = {
  active: true,
  archived: false,
  status: "APPROVED",
  OR: [{ vendorId: null }, { vendor: { is: { active: true } } }],
};

export const VENDOR_COOKIE = "vendor_session";

export interface VendorSession {
  id: string;
  slug: string;
  name: string;
  whatsapp: string;
  maxProducts: number;
}

function sign(id: string, passHash: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(`vendor:${id}:${passHash}`).digest("hex");
}

export const hashVendorPassword = hashPassword;

/** Jeton de cookie pour un vendeur (change si son mot de passe change). */
export function vendorToken(id: string, passHash: string): string {
  return `${id}.${sign(id, passHash)}`;
}

/** Vendeur connecte (cookie valide, compte actif), ou null. */
export async function currentVendor(): Promise<VendorSession | null> {
  const raw = (await cookies()).get(VENDOR_COOKIE)?.value ?? "";
  const [id, sig] = raw.split(".");
  if (!id || !sig) return null;
  const v = await prisma.vendor.findUnique({ where: { id } }).catch(() => null);
  if (!v || !v.active || !safeEqual(sig, sign(v.id, v.passHash))) return null;
  return { id: v.id, slug: v.slug, name: v.name, whatsapp: v.whatsapp, maxProducts: v.maxProducts };
}

/** Connexion : identifiant = numero WhatsApp (ou nom court du vendeur) + mot de passe. */
export async function vendorForLogin(identifier: string, password: string) {
  const digits = identifier.replace(/\D/g, "");
  const slug = identifier.trim().toLowerCase();
  const candidates = await prisma.vendor.findMany({
    where: { OR: [...(digits.length >= 8 ? [{ whatsapp: { endsWith: digits.slice(-8) } }] : []), { slug }] },
  });
  for (const v of candidates) if (verifyHash(password, v.passHash)) return v;
  return null;
}

/** Numero WhatsApp normalise (Mali par defaut : 8 chiffres -> 223XXXXXXXX). */
export function normalizeWhatsapp(input: string): string {
  const d = input.replace(/\D/g, "").replace(/^00/, "");
  return d.length === 8 ? `223${d}` : d;
}
