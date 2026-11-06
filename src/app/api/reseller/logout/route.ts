import { NextResponse } from "next/server";
import { RESELLER_COOKIE } from "@/lib/reseller-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(RESELLER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
