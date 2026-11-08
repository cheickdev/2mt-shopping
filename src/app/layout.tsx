import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart";
import Header from "@/components/Header";
import { getSettings } from "@/lib/settings";
import { getCategories } from "@/lib/categories";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "2MT - Shopping — Chaussures & Cosmétiques à Bamako",
    template: "%s | 2MT - Shopping",
  },
  description:
    "Chaussures et cosmétiques livrés à Bamako. Commandez en ligne, payez à la livraison. 2MT - Shopping.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "2MT - Shopping", statusBarStyle: "default" },
  openGraph: {
    title: "2MT - Shopping",
    description: "Chaussures et cosmétiques livrés à Bamako. Payez à la livraison.",
    url: SITE_URL,
    siteName: "2MT - Shopping",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#b11f5c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <CartProvider>
          <Header shopName={settings.shopName} categories={categories} />
          <main className="container">{children}</main>
          <footer className="footer">
            {settings.shopName} — Bamako. Commandez en ligne, payez à la livraison.
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
