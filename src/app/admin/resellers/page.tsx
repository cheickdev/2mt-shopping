import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { maskKey } from "@/lib/reseller-auth";
import AdminShell from "../AdminShell";
import ResellersManager, { ResellerRow } from "./ResellersManager";

export const dynamic = "force-dynamic";

export default async function AdminResellers() {
  if (!(await isAdmin())) redirect("/admin/login");

  const resellers = await prisma.reseller.findMany({ orderBy: { createdAt: "desc" } });
  const rows: ResellerRow[] = resellers.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    maskedKey: maskKey(r.apiKey),
    balanceCents: r.balanceCents,
    marginPercent: r.resellerMarginPercent,
    rateLimitPerMin: r.rateLimitPerMin,
    active: r.active,
  }));

  return (
    <AdminShell>
      <h1>Revendeurs</h1>
      <p style={{ color: "var(--muted)" }}>
        Creez des comptes revendeurs (cle API generee), ajustez leur solde, leur marge et leur statut.
      </p>
      <ResellersManager initial={rows} />
    </AdminShell>
  );
}
