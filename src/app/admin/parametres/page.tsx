import { redirect } from "next/navigation";
import { currentRole } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import AdminShell from "../AdminShell";
import SettingsForm from "@/components/admin/SettingsForm";
import DbUpdateButton from "@/components/admin/DbUpdateButton";

export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "owner") redirect("/admin"); // réservé au propriétaire
  const settings = await getSettings();
  return (
    <AdminShell owner>
      <h1>Paramètres</h1>
      <p className="note" style={{ marginTop: 0 }}>Réglez votre boutique : WhatsApp, livraison, partage du bénéfice.</p>
      <SettingsForm initial={settings} />
      <DbUpdateButton />
    </AdminShell>
  );
}
