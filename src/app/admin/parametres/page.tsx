import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import AdminShell from "../AdminShell";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  if (!(await isAdmin())) redirect("/admin/login");
  const settings = await getSettings();
  return (
    <AdminShell>
      <h1>Paramètres</h1>
      <p className="note" style={{ marginTop: 0 }}>Réglez votre boutique : WhatsApp, livraison, partage du bénéfice.</p>
      <SettingsForm initial={settings} />
    </AdminShell>
  );
}
