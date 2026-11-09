"use client";

import { useRouter, usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Tableau de bord", ownerOnly: false },
  { href: "/admin/produits", label: "Produits", ownerOnly: false },
  { href: "/admin/commandes", label: "Commandes", ownerOnly: false },
  { href: "/admin/parametres", label: "Paramètres", ownerOnly: true },
];

export default function AdminShell({
  children,
  owner = false,
  userName,
}: {
  children: React.ReactNode;
  owner?: boolean;
  userName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const links = LINKS.filter((l) => owner || !l.ownerOnly);

  return (
    <div className="admin">
      <aside className="admin-side">
        <a href="/" className="logo">2<b>MT</b></a>
        <nav className="admin-nav">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
              {l.label}
            </a>
          ))}
        </nav>
        <a href="/" className="admin-shop-link">← Voir la boutique</a>
        {userName && (
          <div className="note" style={{ marginTop: "auto", marginBottom: 6 }}>
            Connecté : <strong style={{ color: "var(--fg)" }}>{userName}</strong>
            {!owner && <span> · partenaire</span>}
          </div>
        )}
        <button className="admin-logout" onClick={logout} style={userName ? { marginTop: 0 } : undefined}>Se déconnecter</button>
      </aside>
      <section className="admin-main">{children}</section>
    </div>
  );
}
