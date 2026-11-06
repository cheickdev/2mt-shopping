import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateResetToken } from "@/lib/customer-auth";
import { sendEmail, passwordResetEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

// POST /api/account/forgot — demande de reinitialisation.
// Reponse toujours { ok: true } : on n'indique pas si l'email existe (anti-enumeration).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requete invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Email invalide." }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (customer) {
    const { raw, hash } = generateResetToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await prisma.customer.update({
      where: { id: customer.id },
      data: { resetTokenHash: hash, resetTokenExpiry: expiry },
    });

    const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const resetUrl = `${site}/account/reset?token=${raw}`;
    const msg = passwordResetEmail(resetUrl);
    await sendEmail({ ...msg, to: customer.email });
  }

  return NextResponse.json({ ok: true });
}
