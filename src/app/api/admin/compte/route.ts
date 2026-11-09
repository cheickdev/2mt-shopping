import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, currentRole, hashPassword, tokenForRole } from "@/lib/admin-auth";

// « Mon compte » : chaque administrateur change SON nom et SON mot de passe.
const schema = z.object({
  name: z.string().trim().min(1, "Indiquez votre nom.").max(40, "Nom trop long (40 max).").optional(),
  password: z.string().min(4, "Mot de passe trop court (4 min).").optional(),
});

export async function PATCH(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." }, { status: 400 });
  }
  const { name, password } = parsed.data;

  const data: Record<string, string> = {};
  if (name) data[role === "owner" ? "ownerName" : "partnerName"] = name;
  if (password && password.trim()) data[role === "owner" ? "ownerPassHash" : "partnerPassHash"] = hashPassword(password.trim());
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });

  await prisma.setting.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });

  // Changer le mot de passe invalide la session : on en redonne une nouvelle
  // pour rester connecte sur cet appareil.
  if (password) {
    const token = await tokenForRole(role);
    if (token) {
      const store = await cookies();
      store.set(ADMIN_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
