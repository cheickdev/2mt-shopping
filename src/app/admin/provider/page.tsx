import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { providerMode } from "@/lib/providers/dhru";
import AdminShell from "../AdminShell";
import ProviderCatalog from "./ProviderCatalog";

export const dynamic = "force-dynamic";

export default async function AdminProvider() {
  if (!(await isAdmin())) redirect("/admin/login");

  const live = providerMode() === "live";

  return (
    <AdminShell>
      <h1>Catalogue fournisseur</h1>
      <p style={{ color: "var(--muted)" }}>
        Liste des services proposes par le grossiste (GSMUnlockUSA). Copiez l&apos;
        <strong> ID fournisseur</strong> d&apos;un service, puis collez-le dans la colonne
        &laquo; ID fournisseur &raquo; du service correspondant dans{" "}
        <a href="/admin/services">Services</a>.
      </p>

      {!live && (
        <div className="error" style={{ marginTop: 12 }}>
          Mode fournisseur en <strong>simulation</strong>. Pour voir le vrai catalogue, definissez
          sur Vercel&nbsp;: <code>PROVIDER_MODE=live</code>, <code>DHRU_API_URL</code>,
          <code> DHRU_USERNAME</code>, <code>DHRU_API_KEY</code>, puis redeployez.
        </div>
      )}

      <ProviderCatalog />
    </AdminShell>
  );
}
