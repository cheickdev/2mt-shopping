import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { LoginForm } from "../AccountForms";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentCustomer()) redirect("/account");
  return (
    <main style={{ maxWidth: 440, margin: "60px auto", padding: "0 20px" }}>
      <h1>Connexion</h1>
      <p style={{ color: "var(--muted)" }}>Accedez a l&apos;historique de vos commandes.</p>
      <LoginForm />
    </main>
  );
}
