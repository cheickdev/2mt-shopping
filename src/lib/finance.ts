// Gestion financiere de la boutique : calculs (soldes, historiques, statut des
// emprunts, totaux). Fonctions pures, utilisables cote serveur ET navigateur.
// Montants en francs CFA entiers.

export type AccountKind = "TRESORERIE" | "PRETEUR";
export type EntryType = "REVENU" | "ACHAT" | "DEPENSE" | "EMPRUNT" | "REMBOURSEMENT" | "TRANSFERT";

export interface FinAccount {
  id: string;
  name: string;
  kind: AccountKind;
  note: string;
  archived: boolean;
}

export interface FinEntry {
  id: string;
  date: string; // ISO
  type: EntryType;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  payee: string;
  category: string;
  description: string;
  createdBy: string;
}

export const ENTRY_TYPES: { type: EntryType; label: string; icon: string; help: string }[] = [
  { type: "ACHAT", label: "Achat de marchandises", icon: "🛒", help: "Marchandises achetées pour la boutique" },
  { type: "DEPENSE", label: "Dépense", icon: "💸", help: "Transport, loyer, pub, emballages…" },
  { type: "REVENU", label: "Revenu", icon: "💰", help: "Ventes ou autre argent reçu" },
  { type: "EMPRUNT", label: "Emprunt reçu", icon: "🤝", help: "Argent prêté par quelqu'un" },
  { type: "REMBOURSEMENT", label: "Remboursement", icon: "↩️", help: "Vous remboursez un prêteur" },
  { type: "TRANSFERT", label: "Transfert", icon: "🔁", help: "D'un de vos comptes à un autre" },
];
export const typeLabel = (t: EntryType) => ENTRY_TYPES.find((x) => x.type === t)?.label ?? t;
export const typeIcon = (t: EntryType) => ENTRY_TYPES.find((x) => x.type === t)?.icon ?? "";

/** Quels comptes une operation accepte : [compte principal, compte destination | null]. */
export function accountRoles(t: EntryType): [AccountKind[], AccountKind[] | null] {
  switch (t) {
    case "REVENU":
      return [["TRESORERIE"], null];
    case "ACHAT":
    case "DEPENSE":
      return [["TRESORERIE", "PRETEUR"], null];
    case "EMPRUNT":
      return [["PRETEUR"], ["TRESORERIE"]];
    case "REMBOURSEMENT":
      return [["TRESORERIE"], ["PRETEUR"]];
    case "TRANSFERT":
      return [["TRESORERIE"], ["TRESORERIE"]];
  }
}

/**
 * Effet d'une operation sur un compte.
 * Tresorerie : + = argent qui entre. Preteur : + = dette qui augmente.
 */
export function effectOn(e: FinEntry, acc: FinAccount): number {
  const main = e.accountId === acc.id;
  const dest = e.toAccountId === acc.id;
  if (!main && !dest) return 0;
  if (acc.kind === "TRESORERIE") {
    switch (e.type) {
      case "REVENU":
        return main ? e.amount : 0;
      case "ACHAT":
      case "DEPENSE":
      case "REMBOURSEMENT":
        return main ? -e.amount : 0;
      case "EMPRUNT":
        return dest ? e.amount : 0;
      case "TRANSFERT":
        return (dest ? e.amount : 0) - (main ? e.amount : 0);
    }
  } else {
    switch (e.type) {
      case "ACHAT":
      case "DEPENSE":
      case "EMPRUNT":
        return main ? e.amount : 0;
      case "REMBOURSEMENT":
        return dest ? -e.amount : 0;
      default:
        return 0;
    }
  }
  return 0;
}

const byDate = (a: FinEntry, b: FinEntry) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

export interface HistoryLine {
  entry: FinEntry;
  effect: number;
  balance: number; // solde apres cette operation
}

/** Historique d'un compte avec solde progressif (du plus ancien au plus recent). */
export function accountHistory(acc: FinAccount, entries: FinEntry[]): HistoryLine[] {
  let bal = 0;
  const out: HistoryLine[] = [];
  for (const e of [...entries].sort(byDate)) {
    const eff = effectOn(e, acc);
    if (!eff) continue;
    bal += eff;
    out.push({ entry: e, effect: eff, balance: bal });
  }
  return out;
}

export function balanceOf(acc: FinAccount, entries: FinEntry[]): number {
  return entries.reduce((s, e) => s + effectOn(e, acc), 0);
}

export type DebtStatus = "REMBOURSE" | "PARTIEL" | "A_REMBOURSER";

export interface DebtLine {
  entry: FinEntry; // l'emprunt, ou l'achat/depense paye par le preteur
  repaid: number;
  remaining: number;
  status: DebtStatus;
}

/**
 * Statut de chaque somme due a un preteur. Les remboursements soldent les
 * dettes les plus anciennes d'abord.
 */
export function debtLines(acc: FinAccount, entries: FinEntry[]): DebtLine[] {
  if (acc.kind !== "PRETEUR") return [];
  const sorted = [...entries].sort(byDate);
  const debts = sorted.filter((e) => effectOn(e, acc) > 0).map((e) => ({ entry: e, repaid: 0 }));
  let pool = sorted.filter((e) => effectOn(e, acc) < 0).reduce((s, e) => s - effectOn(e, acc), 0);
  for (const d of debts) {
    const take = Math.min(pool, d.entry.amount);
    d.repaid = take;
    pool -= take;
  }
  return debts.map((d) => {
    const remaining = d.entry.amount - d.repaid;
    return { ...d, remaining, status: remaining <= 0 ? "REMBOURSE" : d.repaid > 0 ? "PARTIEL" : "A_REMBOURSER" };
  });
}

export interface Totals {
  revenus: number;
  achats: number;
  depenses: number;
  resultat: number; // revenus - achats - depenses
  empruntsRecus: number; // emprunts + achats/depenses payes par des preteurs
  remboursements: number;
}

/** Totaux d'une periode (mois "AAAA-MM", ou tout si null). */
export function totals(entries: FinEntry[], accounts: FinAccount[], month: string | null): Totals {
  const kind = new Map(accounts.map((a) => [a.id, a.kind]));
  const list = month ? entries.filter((e) => e.date.slice(0, 7) === month) : entries;
  const t: Totals = { revenus: 0, achats: 0, depenses: 0, resultat: 0, empruntsRecus: 0, remboursements: 0 };
  for (const e of list) {
    if (e.type === "REVENU") t.revenus += e.amount;
    if (e.type === "ACHAT") t.achats += e.amount;
    if (e.type === "DEPENSE") t.depenses += e.amount;
    if (e.type === "EMPRUNT" || ((e.type === "ACHAT" || e.type === "DEPENSE") && kind.get(e.accountId) === "PRETEUR")) t.empruntsRecus += e.amount;
    if (e.type === "REMBOURSEMENT") t.remboursements += e.amount;
  }
  t.resultat = t.revenus - t.achats - t.depenses;
  return t;
}

/** Verifie qu'une operation est coherente (types de comptes). Renvoie un message d'erreur ou null. */
export function validateEntry(
  e: Pick<FinEntry, "type" | "amount" | "accountId" | "toAccountId">,
  accounts: Pick<FinAccount, "id" | "kind">[]
): string | null {
  if (!(e.amount > 0)) return "Indiquez un montant.";
  const [mainKinds, destKinds] = accountRoles(e.type);
  const main = accounts.find((a) => a.id === e.accountId);
  if (!main || !mainKinds.includes(main.kind)) return "Choisissez le compte.";
  if (destKinds) {
    const dest = accounts.find((a) => a.id === e.toAccountId);
    if (!dest || !destKinds.includes(dest.kind)) return "Choisissez le compte de destination.";
    if (dest.id === main.id) return "Les deux comptes doivent être différents.";
  }
  return null;
}
