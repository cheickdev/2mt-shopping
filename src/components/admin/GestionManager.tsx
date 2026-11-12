"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFcfa, parseFcfa } from "@/lib/money";
import {
  ENTRY_TYPES,
  accountHistory,
  accountRoles,
  balanceOf,
  debtLines,
  totals,
  typeIcon,
  typeLabel,
  validateEntry,
  type AccountKind,
  type EntryType,
  type FinAccount,
  type FinEntry,
} from "@/lib/finance";

type Tab = "resume" | "ajouter" | "historique" | "comptes";

const CATEGORIES: Partial<Record<EntryType, string[]>> = {
  DEPENSE: ["Transport", "Livraison", "Publicité", "Loyer", "Électricité", "Téléphone / Internet", "Emballages", "Salaires", "Autre"],
  ACHAT: ["Parfums", "Soins du corps", "Gels douche & savons", "Cheveux", "Déodorants", "Chaussures", "Autre"],
  REVENU: ["Ventes boutique", "Ventes en ligne", "Apport d'un associé", "Autre"],
};

const today = () => new Date().toISOString().slice(0, 10);
const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const monthFr = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};
const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + formatFcfa(Math.abs(n));

async function send(url: string, method: string, body?: object): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return await res.json();
  } catch {
    return { ok: false, error: "Pas de connexion. Réessayez." };
  }
}

export default function GestionManager({ accounts, entries }: { accounts: FinAccount[]; entries: FinEntry[] }) {
  const [tab, setTab] = useState<Tab>(accounts.length ? "resume" : "comptes");
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const names = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const done = (msg: string, next?: Tab) => {
    setFlash(msg);
    if (next) setTab(next);
    setTimeout(() => setFlash(null), 4000);
  };

  return (
    <div className="ges">
      <div className="ges-tabs">
        {(
          [
            ["resume", "📊 Résumé"],
            ["ajouter", "➕ Nouvelle opération"],
            ["historique", "📜 Historique"],
            ["comptes", "🏦 Comptes"],
          ] as [Tab, string][]
        ).map(([t, l]) => (
          <button key={t} className={`btn sm ${tab === t ? "" : "ghost"}`} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      {flash && <div className="cats-ok">{flash}</div>}

      {tab === "resume" && <Resume accounts={accounts} entries={entries} onOpen={(id) => setOpenAccount(id)} />}
      {tab === "ajouter" && <AddEntry accounts={accounts} entries={entries} onDone={(m) => done(m, "historique")} goAccounts={() => setTab("comptes")} />}
      {tab === "historique" && <History accounts={accounts} entries={entries} names={names} onDone={done} />}
      {tab === "comptes" && <Accounts accounts={accounts} entries={entries} onOpen={(id) => setOpenAccount(id)} onDone={done} />}

      {openAccount && (
        <AccountDetail account={accounts.find((a) => a.id === openAccount)!} entries={entries} names={names} onClose={() => setOpenAccount(null)} />
      )}
    </div>
  );
}

// ---------- Resume ----------
function Resume({ accounts, entries, onOpen }: { accounts: FinAccount[]; entries: FinEntry[]; onOpen: (id: string) => void }) {
  const months = useMemo(() => [...new Set(entries.map((e) => e.date.slice(0, 7)))].sort().reverse(), [entries]);
  const [month, setMonth] = useState<string>(months[0] ?? "");
  const t = totals(entries, accounts, month || null);
  const tres = accounts.filter((a) => a.kind === "TRESORERIE" && !a.archived);
  const lenders = accounts.filter((a) => a.kind === "PRETEUR" && !a.archived);
  const cash = tres.reduce((s, a) => s + balanceOf(a, entries), 0);
  const debt = lenders.reduce((s, a) => s + balanceOf(a, entries), 0);

  if (!accounts.length) return <p className="note">Commencez par créer vos comptes dans l'onglet « 🏦 Comptes ».</p>;

  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <div className="k">💵 Argent disponible</div>
          <div className={`v ${cash < 0 ? "neg" : "accent"}`}>{formatFcfa(cash)}</div>
        </div>
        <div className="stat">
          <div className="k">🤝 Dettes à rembourser</div>
          <div className={`v ${debt > 0 ? "neg" : ""}`}>{formatFcfa(debt)}</div>
        </div>
      </div>

      <div className="ges-period">
        <label className="note" htmlFor="ges-month">Période :</label>
        <select id="ges-month" className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthFr(m)}
            </option>
          ))}
          <option value="">Depuis le début</option>
        </select>
      </div>
      <div className="stat-row">
        <div className="stat"><div className="k">💰 Revenus</div><div className="v pos">{formatFcfa(t.revenus)}</div></div>
        <div className="stat"><div className="k">🛒 Achats marchandises</div><div className="v">{formatFcfa(t.achats)}</div></div>
        <div className="stat"><div className="k">💸 Dépenses</div><div className="v">{formatFcfa(t.depenses)}</div></div>
        <div className="stat">
          <div className="k">📈 Résultat</div>
          <div className={`v ${t.resultat < 0 ? "neg" : "pos"}`}>{signed(t.resultat)}</div>
        </div>
      </div>
      <p className="note" style={{ marginTop: -6 }}>
        Résultat = revenus − achats − dépenses. Sur la période : {formatFcfa(t.empruntsRecus)} empruntés, {formatFcfa(t.remboursements)} remboursés.
      </p>

      <h3>Vos comptes</h3>
      <div className="ges-accs">
        {[...tres, ...lenders].map((a) => (
          <AccountCard key={a.id} a={a} entries={entries} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

function AccountCard({ a, entries, onOpen }: { a: FinAccount; entries: FinEntry[]; onOpen: (id: string) => void }) {
  const bal = balanceOf(a, entries);
  const lender = a.kind === "PRETEUR";
  return (
    <button className={`ges-acc ${lender ? "lender" : ""}`} onClick={() => onOpen(a.id)}>
      <span className="ges-acc-name">
        {lender ? "🤝" : "💵"} {a.name}
      </span>
      <span className="note">{lender ? (bal > 0 ? "Vous lui devez" : "Rien à rembourser") : "Solde"}</span>
      <span className={`ges-acc-bal ${(!lender && bal < 0) || (lender && bal > 0) ? "neg" : ""}`}>{formatFcfa(bal)}</span>
      {lender && bal <= 0 && <span className="pill LIVREE">✓ Remboursé</span>}
      <span className="note ges-acc-more">Voir l'historique →</span>
    </button>
  );
}

// ---------- Nouvelle operation ----------
function AddEntry({
  accounts,
  entries,
  onDone,
  goAccounts,
}: {
  accounts: FinAccount[];
  entries: FinEntry[];
  onDone: (msg: string) => void;
  goAccounts: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<EntryType>("ACHAT");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [payee, setPayee] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = accounts.filter((a) => !a.archived);
  const [mainKinds, destKinds] = accountRoles(type);
  const mainOpts = active.filter((a) => mainKinds.includes(a.kind));
  const destOpts = destKinds ? active.filter((a) => destKinds.includes(a.kind) && a.id !== accountId) : [];
  const payees = useMemo(() => [...new Set(entries.map((e) => e.payee).filter(Boolean))].sort(), [entries]);

  const labels: Record<EntryType, { main: string; dest?: string; payee?: string }> = {
    ACHAT: { main: "Payé avec quel argent ?", payee: "À qui l'argent a été remis ? (fournisseur)" },
    DEPENSE: { main: "Payé avec quel argent ?", payee: "À qui l'argent a été remis ?" },
    REVENU: { main: "Argent reçu sur quel compte ?", payee: "De qui ? (client, associé…)" },
    EMPRUNT: { main: "Qui vous a prêté ?", dest: "Argent reçu sur quel compte ?" },
    REMBOURSEMENT: { main: "Payé depuis quel compte ?", dest: "Quel prêteur remboursez-vous ?" },
    TRANSFERT: { main: "Depuis quel compte ?", dest: "Vers quel compte ?" },
  };
  const L = labels[type];
  const optLabel = (a: FinAccount) => (a.kind === "PRETEUR" ? `🤝 Argent emprunté à ${a.name}` : `💵 ${a.name}`);

  function pickType(t: EntryType) {
    setType(t);
    setAccountId("");
    setToAccountId("");
    setCategory("");
    setError(null);
  }

  async function save() {
    const body = { date, type, amount: parseFcfa(amount), accountId, toAccountId: destKinds ? toAccountId : null, payee, category, description };
    const err = validateEntry(body, accounts);
    if (err) return setError(err);
    setSaving(true);
    setError(null);
    const d = await send("/api/admin/gestion", "POST", body);
    setSaving(false);
    if (!d.ok) return setError(d.error ?? "Enregistrement impossible.");
    setAmount("");
    setPayee("");
    setCategory("");
    setDescription("");
    router.refresh();
    onDone(`✅ ${typeLabel(type)} de ${formatFcfa(body.amount)} enregistré.`);
  }

  if (!active.some((a) => a.kind === "TRESORERIE")) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <p style={{ marginTop: 0 }}>Avant d'ajouter une opération, créez au moins un compte d'argent (par exemple « Caisse » ou « Orange Money »).</p>
        <button className="btn" onClick={goAccounts}>🏦 Créer mes comptes</button>
      </div>
    );
  }

  const debtOf = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? balanceOf(a, entries) : 0;
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="ges-types">
        {ENTRY_TYPES.map((t) => (
          <button key={t.type} type="button" className={`ges-type ${type === t.type ? "on" : ""}`} onClick={() => pickType(t.type)}>
            <span className="ges-type-icon">{t.icon}</span>
            <span className="ges-type-label">{t.label}</span>
            <span className="ges-type-help">{t.help}</span>
          </button>
        ))}
      </div>

      <div className="pe-form" style={{ borderTop: "none" }}>
        <div className="field">
          <label>Date</label>
          <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Montant (FCFA)</label>
          <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex. 50 000" />
        </div>
        <div className="field pe-full">
          <label>{L.main}</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— Choisir —</option>
            {mainOpts.map((a) => (
              <option key={a.id} value={a.id}>
                {type === "EMPRUNT" ? a.name : optLabel(a)}
              </option>
            ))}
          </select>
          {mainOpts.length === 0 && (
            <span className="note">
              Aucun compte de ce genre. <button className="linklike" onClick={goAccounts}>Créer un compte</button>
            </span>
          )}
          {(type === "ACHAT" || type === "DEPENSE") && accounts.find((a) => a.id === accountId)?.kind === "PRETEUR" && (
            <span className="note">Cette somme sera ajoutée à ce que vous devez à ce prêteur.</span>
          )}
        </div>
        {destKinds && (
          <div className="field pe-full">
            <label>{L.dest}</label>
            <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">— Choisir —</option>
              {destOpts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.kind === "PRETEUR" ? `${a.name} (vous lui devez ${formatFcfa(debtOf(a.id))})` : a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {L.payee && (
          <div className="field pe-full">
            <label>{L.payee}</label>
            <input className="input" list="ges-payees" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Nom de la personne ou du magasin" />
            <datalist id="ges-payees">
              {payees.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        )}
        {CATEGORIES[type] && (
          <div className="field pe-full">
            <label>Catégorie</label>
            <div className="ges-chips">
              {CATEGORIES[type]!.map((c) => (
                <button key={c} type="button" className={`cat-chip ${category === c ? "all" : ""}`} onClick={() => setCategory(category === c ? "" : c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field pe-full">
          <label>Détails (facultatif)</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. 2 cartons de parfums Proud of You" />
        </div>
      </div>
      {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}
      <button className="btn block" onClick={save} disabled={saving}>
        {saving ? "Enregistrement…" : `Enregistrer ${typeLabel(type).toLowerCase()}`}
      </button>
    </div>
  );
}

// ---------- Historique ----------
function describe(e: FinEntry, names: Map<string, string>, accounts: FinAccount[]): string {
  const n = (id: string | null) => (id ? names.get(id) ?? "?" : "?");
  const lender = accounts.find((a) => a.id === e.accountId)?.kind === "PRETEUR";
  switch (e.type) {
    case "ACHAT":
    case "DEPENSE":
      return `${lender ? `Payé avec l'argent de ${n(e.accountId)} (emprunt)` : `Payé depuis ${n(e.accountId)}`}${e.payee ? ` · remis à ${e.payee}` : ""}`;
    case "REVENU":
      return `Reçu sur ${n(e.accountId)}${e.payee ? ` · de ${e.payee}` : ""}`;
    case "EMPRUNT":
      return `Prêté par ${n(e.accountId)} · reçu sur ${n(e.toAccountId)}`;
    case "REMBOURSEMENT":
      return `${n(e.toAccountId)} remboursé depuis ${n(e.accountId)}`;
    case "TRANSFERT":
      return `${n(e.accountId)} → ${n(e.toAccountId)}`;
  }
}

function History({
  accounts,
  entries,
  names,
  onDone,
}: {
  accounts: FinAccount[];
  entries: FinEntry[];
  names: Map<string, string>;
  onDone: (m: string) => void;
}) {
  const router = useRouter();
  const [ftype, setFtype] = useState<string>("");
  const [facc, setFacc] = useState<string>("");
  const [q, setQ] = useState("");
  const list = entries.filter(
    (e) =>
      (!ftype || e.type === ftype) &&
      (!facc || e.accountId === facc || e.toAccountId === facc) &&
      (!q || `${e.payee} ${e.category} ${e.description}`.toLowerCase().includes(q.toLowerCase()))
  );

  async function remove(e: FinEntry) {
    if (!confirm(`Supprimer cette opération (${typeLabel(e.type)} de ${formatFcfa(e.amount)}) ?`)) return;
    const d = await send(`/api/admin/gestion?id=${encodeURIComponent(e.id)}`, "DELETE");
    if (d.ok) {
      router.refresh();
      onDone("🗑️ Opération supprimée.");
    }
  }

  const sign = (e: FinEntry) => (e.type === "REVENU" || e.type === "EMPRUNT" ? 1 : e.type === "TRANSFERT" ? 0 : -1);

  return (
    <>
      <div className="ges-filters">
        <select className="input" value={ftype} onChange={(e) => setFtype(e.target.value)} aria-label="Type">
          <option value="">Toutes les opérations</option>
          {ENTRY_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
        <select className="input" value={facc} onChange={(e) => setFacc(e.target.value)} aria-label="Compte">
          <option value="">Tous les comptes</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Chercher (nom, détail…)" />
      </div>
      {list.length === 0 ? (
        <p className="note">Aucune opération{entries.length ? " pour ce filtre" : " pour le moment"}.</p>
      ) : (
        <div className="ges-list">
          {list.map((e) => (
            <div key={e.id} className="ges-row">
              <span className="ges-row-icon">{typeIcon(e.type)}</span>
              <div className="ges-row-main">
                <div className="ges-row-top">
                  <strong>{typeLabel(e.type)}{e.category ? ` · ${e.category}` : ""}</strong>
                  <span className={`ges-amt ${sign(e) > 0 ? "pos" : sign(e) < 0 ? "neg" : ""}`}>
                    {sign(e) > 0 ? "+" : sign(e) < 0 ? "−" : ""}
                    {formatFcfa(e.amount)}
                  </span>
                </div>
                <span className="note">{describe(e, names, accounts)}</span>
                {e.description && <span className="ges-desc">{e.description}</span>}
                <span className="note ges-meta">
                  {dateFr(e.date)}
                  {e.createdBy ? ` · saisi par ${e.createdBy}` : ""}
                  <button className="linklike danger" onClick={() => remove(e)}>Supprimer</button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Comptes ----------
function Accounts({
  accounts,
  entries,
  onOpen,
  onDone,
}: {
  accounts: FinAccount[];
  entries: FinEntry[];
  onOpen: (id: string) => void;
  onDone: (m: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("TRESORERIE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  async function create(n = name, k = kind) {
    if (!n.trim()) return setError("Donnez un nom au compte.");
    setBusy(true);
    setError(null);
    const d = await send("/api/admin/gestion/comptes", "POST", { name: n.trim(), kind: k });
    setBusy(false);
    if (!d.ok) return setError(d.error ?? "Création impossible.");
    setName("");
    router.refresh();
    onDone(`✅ Compte « ${n.trim()} » créé.`);
  }

  async function patch(id: string, data: object, msg: string) {
    const d = await send("/api/admin/gestion/comptes", "PATCH", { id, ...data });
    if (d.ok) {
      router.refresh();
      onDone(msg);
    }
  }

  const has = (n: string) => accounts.some((a) => a.name.toLowerCase() === n.toLowerCase());
  const suggestions = ["Caisse", "Orange Money", "Moov Money", "Banque"].filter((s) => !has(s));
  const shown = accounts.filter((a) => showArchived || !a.archived);

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Nouveau compte</h3>
        <div className="ges-kind">
          <button type="button" className={`ges-type ${kind === "TRESORERIE" ? "on" : ""}`} onClick={() => setKind("TRESORERIE")}>
            <span className="ges-type-icon">💵</span>
            <span className="ges-type-label">Compte d'argent</span>
            <span className="ges-type-help">Caisse, Orange Money, banque…</span>
          </button>
          <button type="button" className={`ges-type ${kind === "PRETEUR" ? "on" : ""}`} onClick={() => setKind("PRETEUR")}>
            <span className="ges-type-icon">🤝</span>
            <span className="ges-type-label">Prêteur</span>
            <span className="ges-type-help">Personne ou organisme qui vous prête</span>
          </button>
        </div>
        <div className="imp-url" style={{ marginTop: 10 }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "PRETEUR" ? "Ex. Moussa, Tonton Ali, Banque BMS…" : "Ex. Caisse, Orange Money…"}
          />
          <button className="btn sm" onClick={() => create()} disabled={busy}>Créer</button>
        </div>
        {suggestions.length > 0 && (
          <div className="ges-chips" style={{ marginTop: 8 }}>
            <span className="note">Ajout rapide :</span>
            {suggestions.map((s) => (
              <button key={s} className="cat-chip" onClick={() => create(s, "TRESORERIE")} disabled={busy}>
                + {s}
              </button>
            ))}
          </div>
        )}
        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      <div className="ges-accs">
        {shown.map((a) => (
          <div key={a.id} className={`ges-acc static ${a.archived ? "archived" : ""}`}>
            <AccountCard a={a} entries={entries} onOpen={onOpen} />
            <div className="ges-acc-actions">
              <button
                className="linklike"
                onClick={() => {
                  const n = prompt("Nouveau nom du compte :", a.name);
                  if (n && n.trim() && n.trim() !== a.name) patch(a.id, { name: n.trim() }, "✅ Compte renommé.");
                }}
              >
                Renommer
              </button>
              <button className="linklike" onClick={() => patch(a.id, { archived: !a.archived }, a.archived ? "✅ Compte réactivé." : "📦 Compte archivé.")}>
                {a.archived ? "Réactiver" : "Archiver"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {accounts.some((a) => a.archived) && (
        <label className="pe-check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Afficher les comptes archivés
        </label>
      )}
    </>
  );
}

// ---------- Detail d'un compte ----------
function AccountDetail({ account, entries, names, onClose }: { account: FinAccount; entries: FinEntry[]; names: Map<string, string>; onClose: () => void }) {
  const hist = accountHistory(account, entries).reverse();
  const debts = debtLines(account, entries).reverse();
  const bal = balanceOf(account, entries);
  const lender = account.kind === "PRETEUR";
  const statusLabel = { REMBOURSE: "✓ Remboursé", PARTIEL: "Partiel", A_REMBOURSER: "À rembourser" } as const;
  const statusClass = { REMBOURSE: "LIVREE", PARTIEL: "EN_LIVRAISON", A_REMBOURSER: "NOUVELLE" } as const;

  return (
    <div className="ges-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ges-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0 }}>
            {lender ? "🤝" : "💵"} {account.name}
          </h3>
          <button className="btn ghost sm" onClick={onClose}>Fermer</button>
        </div>
        <div className="stat" style={{ margin: "12px 0" }}>
          <div className="k">{lender ? "Vous lui devez encore" : "Solde actuel"}</div>
          <div className={`v ${(!lender && bal < 0) || (lender && bal > 0) ? "neg" : "accent"}`}>{formatFcfa(bal)}</div>
          {!lender && bal < 0 && <div className="note">Solde négatif : une rentrée d'argent a peut-être été oubliée.</div>}
        </div>

        {lender && debts.length > 0 && (
          <>
            <h4 style={{ margin: "6px 0" }}>Ce qu'il vous a prêté</h4>
            <div className="ges-list">
              {debts.map((d) => (
                <div key={d.entry.id} className="ges-row">
                  <span className="ges-row-icon">{typeIcon(d.entry.type)}</span>
                  <div className="ges-row-main">
                    <div className="ges-row-top">
                      <strong>
                        {d.entry.type === "EMPRUNT" ? "Prêt" : typeLabel(d.entry.type)}
                        {d.entry.payee ? ` · remis à ${d.entry.payee}` : ""}
                      </strong>
                      <span className={`pill ${statusClass[d.status]}`}>{statusLabel[d.status]}</span>
                    </div>
                    <span className="note">
                      {dateFr(d.entry.date)} · {formatFcfa(d.entry.amount)}
                      {d.status !== "A_REMBOURSER" && ` · remboursé ${formatFcfa(d.repaid)}`}
                      {d.remaining > 0 && ` · reste ${formatFcfa(d.remaining)}`}
                    </span>
                    {d.entry.description && <span className="ges-desc">{d.entry.description}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h4 style={{ margin: "14px 0 6px" }}>Historique</h4>
        {hist.length === 0 ? (
          <p className="note">Aucune opération sur ce compte.</p>
        ) : (
          <div className="ges-list">
            {hist.map((h) => (
              <div key={h.entry.id} className="ges-row">
                <span className="ges-row-icon">{typeIcon(h.entry.type)}</span>
                <div className="ges-row-main">
                  <div className="ges-row-top">
                    <strong>{typeLabel(h.entry.type)}{h.entry.category ? ` · ${h.entry.category}` : ""}</strong>
                    <span className={`ges-amt ${lender ? (h.effect > 0 ? "neg" : "pos") : h.effect > 0 ? "pos" : "neg"}`}>{signed(h.effect)}</span>
                  </div>
                  <span className="note">
                    {dateFr(h.entry.date)}
                    {h.entry.payee ? ` · ${h.entry.payee}` : ""}
                    {h.entry.type === "TRANSFERT" ? ` · ${names.get(h.entry.accountId)} → ${names.get(h.entry.toAccountId ?? "")}` : ""}
                  </span>
                  {h.entry.description && <span className="ges-desc">{h.entry.description}</span>}
                  <span className="note">{lender ? "Dette après" : "Solde après"} : <strong>{formatFcfa(h.balance)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
