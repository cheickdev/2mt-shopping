import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { RegisterForm } from "../AccountForms";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentCustomer()) redirect("/account");
  return (
    <main style={{ maxWidth: 440, margin: "60px auto", padding: "0 20px" }}>
      <h1>Creer un compte</h1>
      <p style={{ color: "var(--muted)" }}>Suivez vos commandes et retrouvez vos resultats.</p>
      <RegisterForm />
    </main>
  );
}
