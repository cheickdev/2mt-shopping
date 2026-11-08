"use client";

import { useRouter, usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/produits", label: "Produits" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/parametres", label: "Paramètres" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin">
      <aside className="admin-side">
        <a href="/" className="logo">2<b>MT</b></a>
        <nav className="admin-nav">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
              {l.label}
            </a>
          ))}
        </nav>
        <button className="admin-logout" onClick={logout}>Se déconnecter</button>
      </aside>
      <section className="admin-main">{children}</section>
    </div>
  );
}
