import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import CartView from "@/components/CartView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mon panier" };

export default async function PanierPage() {
  const settings = await getSettings();
  return <CartView deliveryFee={settings.deliveryFee} whatsapp={settings.whatsapp} />;
}
