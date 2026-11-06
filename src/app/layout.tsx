import type { Metadata } from "next";
import "./globals.css";
import { currentCustomer } from "@/lib/customer-auth";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "UnlockPro — Verification IMEI & Deblocage reseau",
    template: "%s | UnlockPro",
  },
  description:
    "Verifiez l'historique d'un telephone (iCloud, blacklist, operateur) et debloquez-le par IMEI. Resultats rapides, partout dans le monde.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "UnlockPro — Verification IMEI & Deblocage reseau",
    description:
      "Verifiez et debloquez n'importe quel telephone par IMEI. Statut iCloud, blacklist, operateur, deblocage reseau definitif.",
    url: SITE_URL,
    siteName: "UnlockPro",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const customer = await currentCustomer();
  return (
    <html lang="fr">
      <body>
        <div className="container">
          <nav className="nav">
            <a href="/" className="logo" style={{ textDecoration: "none" }}>Unlock<span>Pro</span></a>
            <div style={{ fontSize: 14, display: "flex", gap: 16 }}>
              <a href="/">Services</a>
              <a href="/account">{customer ? "Mon compte" : "Connexion"}</a>
            </div>
          </nav>
          {children}
          <div className="footer">UnlockPro — projet de demonstration.</div>
        </div>
      </body>
    </html>
  );
}
