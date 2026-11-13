import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentVendor } from "@/lib/vendors";
import VendorLogin from "@/components/vendor/VendorLogin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Espace vendeur", robots: { index: false } };

export default async function VendorLoginPage() {
  if (await currentVendor()) redirect("/vendeur/espace");
  return <VendorLogin />;
}
