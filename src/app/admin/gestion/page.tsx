import { redirect } from "next/navigation";
import { currentRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { AccountKind, EntryType, FinAccount, FinEntry } from "@/lib/finance";
import AdminShell from "../AdminShell";
import GestionManager from "@/components/admin/GestionManager";

export const dynamic = "force-dynamic";

export default async function AdminGestion() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  const settings = await getSettings();
  const userName = role === "owner" ? settings.ownerName : settings.partnerName;

  const [accs, ents] = await Promise.all([
    prisma.finAccount.findMany({ orderBy: [{ kind: "desc" }, { createdAt: "asc" }] }).catch(() => []),
    prisma.finEntry.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] }).catch(() => []),
  ]);
  const accounts: FinAccount[] = accs.map((a) => ({ id: a.id, name: a.name, kind: a.kind as AccountKind, note: a.note, archived: a.archived }));
  const entries: FinEntry[] = ents.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    type: e.type as EntryType,
    amount: e.amount,
    accountId: e.accountId,
    toAccountId: e.toAccountId,
    payee: e.payee,
    category: e.category,
    description: e.description,
    createdBy: e.createdBy,
  }));

  return (
    <AdminShell owner={role === "owner"} userName={userName}>
      <h1>Gestion</h1>
      <p className="note" style={{ marginTop: 0 }}>
        Achats de marchandises, dépenses, revenus, emprunts et remboursements : l'historique et le solde de chaque compte.
      </p>
      <GestionManager accounts={accounts} entries={entries} />
    </AdminShell>
  );
}
