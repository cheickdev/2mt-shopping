import { redirect } from "next/navigation";
import { currentRole } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import AdminShell from "../AdminShell";
import AccountForm from "@/components/admin/AccountForm";

export const dynamic = "force-dynamic";

export default async function AdminAccount() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  const settings = await getSettings();
  const owner = role === "owner";
  const name = owner ? settings.ownerName : settings.partnerName;
  return (
    <AdminShell owner={owner} userName={name}>
      <h1>Mon compte</h1>
      <p className="note" style={{ marginTop: 0 }}>
        Connecté en tant que <strong>{owner ? "propriétaire" : "partenaire"}</strong>. Votre nom s'affiche en haut du site quand vous êtes connecté.
      </p>
      <AccountForm initialName={name} />
    </AdminShell>
  );
}
