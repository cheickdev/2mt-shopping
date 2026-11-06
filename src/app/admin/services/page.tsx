import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "../AdminShell";
import ServicesManager, { ServiceRow } from "./ServicesManager";

export const dynamic = "force-dynamic";

export default async function AdminServices() {
  if (!(await isAdmin())) redirect("/admin/login");

  const services = await prisma.service.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
  const rows: ServiceRow[] = services.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    type: s.type,
    category: s.category,
    description: s.description,
    priceCents: s.priceCents,
    costCents: s.costCents,
    estimatedTime: s.estimatedTime,
    dhruServiceId: s.dhruServiceId,
    active: s.active,
  }));

  return (
    <AdminShell>
      <h1>Services</h1>
      <p style={{ color: "var(--muted)" }}>
        Ajustez prix, couts (pour le calcul de marge), delais et disponibilite. La marge se met a jour en direct.
      </p>
      <ServicesManager initial={rows} />
    </AdminShell>
  );
}
