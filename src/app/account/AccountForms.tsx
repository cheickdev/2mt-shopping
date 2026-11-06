"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function useAuthSubmit(endpoint: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send(payload: Record<string, unknown>) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return { send, error, loading };
}

export function LoginForm() {
  const { send, error, loading } = useAuthSubmit("/api/account/login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); send({ email, password }); }} style={{ marginTop: 16 }}>
      <div className="field">
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>Mot de passe</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button className="btn" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
      {error && <div className="error">{error}</div>}
      <div className="note">
        <a href="/account/forgot">Mot de passe oublie ?</a> · Pas de compte ? <a href="/account/register">Creer un compte</a>
      </div>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/account/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true); // reponse toujours OK (anti-enumeration)
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        Si un compte existe pour <strong>{email}</strong>, un email avec un lien de reinitialisation vient d&apos;etre envoye.
        Pensez a verifier vos spams. <a href="/account/login">Retour a la connexion</a>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginTop: 16 }}>
      <div className="field">
        <label>Email de votre compte</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </div>
      <button className="btn" disabled={loading}>{loading ? "Envoi…" : "Envoyer le lien"}</button>
      <div className="note"><a href="/account/login">Retour a la connexion</a></div>
    </form>
  );
}

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = new URLSearchParams(window.location.search).get("token") ?? "";
      const res = await fetch("/api/account/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Echec de la reinitialisation.");
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginTop: 16 }}>
      <div className="field">
        <label>Nouveau mot de passe (8 caracteres min.)</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      </div>
      <button className="btn" disabled={loading}>{loading ? "Enregistrement…" : "Definir le mot de passe"}</button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}

export function RegisterForm() {
  const { send, error, loading } = useAuthSubmit("/api/account/register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); send({ name, email, password }); }} style={{ marginTop: 16 }}>
      <div className="field">
        <label>Nom (optionnel)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>Mot de passe (8 caracteres min.)</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button className="btn" disabled={loading}>{loading ? "Creation…" : "Creer mon compte"}</button>
      {error && <div className="error">{error}</div>}
      <div className="note">Deja un compte ? <a href="/account/login">Se connecter</a></div>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    router.push("/account/login");
    router.refresh();
  }
  return <button className="admin-logout" style={{ marginTop: 0 }} onClick={logout}>Se deconnecter</button>;
}
