"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CLEAN_CATEGORIES } from "@/lib/category-plan";

export interface CatProduct {
  id: string;
  name: string;
  category: string;
  active: boolean;
  proposed: string | null; // categorie proposee par le rangement automatique
}

async function post(body: object): Promise<{ ok: boolean; error?: string; changed?: number }> {
  try {
    const res = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { ok: false, error: "Erreur réseau." };
  }
}

export default function CategoriesManager({ products }: { products: CatProduct[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byCat = useMemo(() => {
    const m = new Map<string, CatProduct[]>();
    for (const p of products) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [products]);
  const allCats = useMemo(() => [...new Set([...byCat.map(([c]) => c), ...CLEAN_CATEGORIES])].sort((a, b) => a.localeCompare(b, "fr")), [byCat]);

  const changes = products.filter((p) => p.proposed && p.proposed !== p.category);
  const changesByTarget = useMemo(() => {
    const m = new Map<string, CatProduct[]>();
    for (const p of changes) m.set(p.proposed!, [...(m.get(p.proposed!) ?? []), p]);
    return [...m.entries()];
  }, [changes]);

  async function run(body: object, done: (n: number) => string) {
    setBusy(true);
    setMsg(null);
    setError(null);
    const d = await post(body);
    setBusy(false);
    if (!d.ok) setError(d.error ?? "Erreur.");
    else {
      setMsg(done(d.changed ?? 0));
      router.refresh();
    }
  }

  return (
    <div className="cats">
      {msg && <div className="cats-ok">{msg}</div>}
      {error && <div className="error">{error}</div>}

      {/* Rangement propose */}
      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>✨ Rangement proposé</h3>
        {changes.length === 0 ? (
          <p className="note" style={{ margin: 0 }}>✅ Vos catégories sont bien rangées : rien à changer.</p>
        ) : (
          <>
            <p className="note" style={{ marginTop: 0 }}>
              {changes.length} produit{changes.length > 1 ? "s" : ""} à ranger dans des catégories claires. Vérifiez, puis appliquez :
              vous pourrez toujours corriger un produit ensuite.
            </p>
            {changesByTarget.map(([to, list]) => (
              <details key={to} className="cats-plan">
                <summary>
                  <strong>{to}</strong> ← {list.length} produit{list.length > 1 ? "s" : ""}
                </summary>
                <ul>
                  {list.map((p) => (
                    <li key={p.id}>
                      {p.name} <span className="note">(avant : {p.category})</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <button className="btn block" style={{ marginTop: 12 }} disabled={busy} onClick={() => run({ action: "plan" }, (n) => `✅ ${n} produits rangés.`)}>
              {busy ? "…" : `Appliquer ce rangement (${changes.length} changement${changes.length > 1 ? "s" : ""})`}
            </button>
          </>
        )}
      </div>

      {/* Categories actuelles */}
      <h3>Vos catégories ({byCat.length})</h3>
      <div className="cats-list">
        {byCat.map(([cat, list]) => (
          <CategoryBlock key={cat} cat={cat} list={list} allCats={allCats} busy={busy} run={run} />
        ))}
      </div>
      <datalist id="cat-all">
        {allCats.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}

function CategoryBlock({
  cat,
  list,
  allCats,
  busy,
  run,
}: {
  cat: string;
  list: CatProduct[];
  allCats: string[];
  busy: boolean;
  run: (body: object, done: (n: number) => string) => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(cat);
  const target = name.trim();
  const merge = target && target !== cat && allCats.includes(target);

  return (
    <details className="card cats-block">
      <summary>
        <span className="cats-name">{cat}</span>
        <span className="pe-chip">{list.length} produit{list.length > 1 ? "s" : ""}</span>
      </summary>
      <div className="cats-body">
        {renaming ? (
          <div className="cats-rename">
            <input className="input" list="cat-all" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nouveau nom" />
            <button
              className="btn sm"
              disabled={busy || !target || target === cat}
              onClick={() => run({ action: "rename", from: cat, to: target }, (n) => `✅ ${n} produits déplacés dans « ${target} ».`)}
            >
              {merge ? "Fusionner" : "Renommer"}
            </button>
            <button className="btn ghost sm" onClick={() => setRenaming(false)}>Annuler</button>
            {merge && <span className="note">« {target} » existe déjà : les deux catégories seront fusionnées.</span>}
          </div>
        ) : (
          <button className="btn ghost sm" onClick={() => setRenaming(true)}>✏️ Renommer ou fusionner</button>
        )}
        <ul className="cats-products">
          {list.map((p) => (
            <li key={p.id}>
              <span className={p.active ? "" : "note"}>
                {p.name}
                {!p.active && " (masqué)"}
              </span>
              <select
                className="input"
                value={p.category}
                disabled={busy}
                onChange={(e) => run({ action: "move", productId: p.id, to: e.target.value }, () => `✅ « ${p.name} » déplacé dans « ${e.target.value} ».`)}
                aria-label={`Catégorie de ${p.name}`}
              >
                {allCats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
