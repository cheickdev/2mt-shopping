"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password && password !== password2) {
      setMsg({ ok: false, text: "Les deux mots de passe ne sont pas identiques." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/compte", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), ...(password ? { password } : {}) }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ ok: false, text: data.error ?? "Erreur" });
        return;
      }
      setPassword("");
      setPassword2("");
      setMsg({ ok: true, text: "Enregistré ✓" });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Erreur réseau" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="summary" onSubmit={save} style={{ maxWidth: 480 }}>
      <div className="field">
        <label htmlFor="acc-name">Mon nom</label>
        <input id="acc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
      </div>
      <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "6px 0" }} />
      <div className="field">
        <label htmlFor="acc-pw">Nouveau mot de passe</label>
        <input id="acc-pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" autoComplete="new-password" />
      </div>
      {password && (
        <div className="field">
          <label htmlFor="acc-pw2">Confirmer le mot de passe</label>
          <input id="acc-pw2" className="input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
        </div>
      )}
      <button className="btn block" disabled={saving || !name.trim()}>{saving ? "…" : "Enregistrer"}</button>
      {msg && <div className={msg.ok ? "success" : "error"}>{msg.text}</div>}
    </form>
  );
}
