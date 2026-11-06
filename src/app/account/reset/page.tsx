import { ResetForm } from "../AccountForms";

export const metadata = { title: "Reinitialiser le mot de passe" };

export default function ResetPage() {
  return (
    <main style={{ maxWidth: 440, margin: "60px auto", padding: "0 20px" }}>
      <h1>Nouveau mot de passe</h1>
      <p style={{ color: "var(--muted)" }}>Choisissez un nouveau mot de passe pour votre compte.</p>
      <ResetForm />
    </main>
  );
}
