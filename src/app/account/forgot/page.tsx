import { ForgotForm } from "../AccountForms";

export const metadata = { title: "Mot de passe oublie" };

export default function ForgotPage() {
  return (
    <main style={{ maxWidth: 440, margin: "60px auto", padding: "0 20px" }}>
      <h1>Mot de passe oublie</h1>
      <p style={{ color: "var(--muted)" }}>Entrez votre email : nous vous enverrons un lien de reinitialisation.</p>
      <ForgotForm />
    </main>
  );
}
