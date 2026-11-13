import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { VENDOR_COOKIE } from "@/lib/vendors";

export async function POST() {
  (await cookies()).delete(VENDOR_COOKIE);
  return NextResponse.json({ ok: true });
}
