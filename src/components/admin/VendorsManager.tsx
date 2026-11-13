"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatFcfa } from "@/lib/money";

export interface VendorRow {
  id: string;
  slug: string;
  name: string;
  whatsapp: string;
  description: string;
  active: boolean;
  maxProducts: number;
  freeUntil: string; // AAAA-MM-JJ ou ""
  total: number;
  online: number;
  pending: number;
}

export interface PendingRow {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  sizes: string;
  description: string;
  gallery: string[];
  vendorName: string;
}

async function call(url: string, method: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok ? null : data.error ?? "Erreur.";
  } catch {
    return "Impossible de contacter le serveur.";
  }
}

function inThreeMonths(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export default function VendorsManager({ vendors, pending }: { vendors: VendorRow[]; pending: PendingRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; whatsapp: string; password: string } | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <section>
        <h2>Produits à valider {pending.length > 0 && <span className="badge-count">{pending.length}</span>}</h2>
        {pending.length === 0 ? (
          <p className="note">Aucun produit en attente.</p>
        ) : (
          <div className="vs-list">
            {pending.map((p) => (
              <PendingItem key={p.id} p={p} onDone={() => router.refresh()} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Mes vendeurs ({vendors.length})</h2>
          {!creating && <button className="btn sm" onClick={() => { setCreated(null); setCreating(true); }}>+ Nouveau vendeur</button>}
        </div>

        {created && (
          <div className="vs-msg" style={{ marginTop: 12 }}>
            ✅ Compte créé pour <b>{created.name}</b>. Envoyez-lui ces informations :
            <pre className="vs-pre">{`Espace vendeur 2MT - Shopping\nLien : https://www.2mt.shop/vendeur/connexion\nNuméro : ${created.whatsapp}\nMot de passe : ${created.password}\nConditions : https://www.2mt.shop/vendeur/conditions`}</pre>
          </div>
        )}

        {creating && (
          <VendorForm
            onCancel={() => setCreating(false)}
            onSaved={(info) => {
              setCreating(false);
              setCreated(info);
              router.refresh();
            }}
          />
        )}

        <div className="vs-list" style={{ marginTop: 12 }}>
          {vendors.length === 0 && !creating && <p className="note">Pas encore de vendeur. Cliquez sur « Nouveau vendeur ».</p>}
          {vendors.map((v) =>
            editing === v.id ? (
              <VendorForm
                key={v.id}
                vendor={v}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  router.refresh();
                }}
              />
            ) : (
              <div key={v.id} className={`vs-item ${v.active ? "" : "off"}`}>
                <div className="vendor-avatar sm" aria-hidden>{v.name.slice(0, 1).toUpperCase()}</div>
                <div className="vs-body">
                  <div className="vs-name">{v.name} {!v.active && <span className="vs-status no">Suspendu</span>}</div>
                  <div className="note">
                    WhatsApp +{v.whatsapp} · {v.online} en ligne · {v.pending} en attente · {v.total}/{v.maxProducts} produits
                  </div>
                  <div className="note">{v.freeUntil ? `Gratuit jusqu'au ${new Date(v.freeUntil).toLocaleDateString("fr-FR")}` : "Gratuit (sans date de fin)"}</div>
                </div>
                <div className="vs-actions">
                  <a className="btn ghost sm" href={`/vendeur/${v.slug}`} target="_blank" rel="noopener noreferrer">Sa boutique</a>
                  <button className="btn ghost sm" onClick={() => setEditing(v.id)}>Modifier</button>
                  <button
                    className={`btn ghost sm ${v.active ? "danger" : ""}`}
                    onClick={async () => {
                      if (v.active && !confirm(`Suspendre ${v.name} ? Tous ses produits disparaîtront du site.`)) return;
                      const err = await call(`/api/admin/vendeurs/${v.id}`, "PATCH", { active: !v.active });
                      if (err) alert(err);
                      router.refresh();
                    }}
                  >
                    {v.active ? "Suspendre" : "Réactiver"}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}

function PendingItem({ p, onDone }: { p: PendingRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [big, setBig] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    const err = await call("/api/admin/vendeurs/validation", "POST", { productId: p.id, action, reason });
    setBusy(false);
    if (err) alert(err);
    else onDone();
  }

  return (
    <div className="vs-item pending">
      <div className="vs-photos">
        {p.gallery.map((src, i) => (
          <button key={i} type="button" className="vs-thumb" onClick={() => setBig(src)} aria-label={`Photo ${i + 1}`}>
            <img src={src} alt="" />
          </button>
        ))}
      </div>
      <div className="vs-body">
        <div className="vs-name">{p.name}</div>
        <div className="note">
          Par <b>{p.vendorName}</b> · {p.category} · {formatFcfa(p.price)} · stock {p.stock}
          {p.sizes && ` · options : ${p.sizes}`}
        </div>
        {p.description && <p className="desc" style={{ margin: "6px 0 0", fontSize: 14 }}>{p.description}</p>}
        {rejecting && (
          <div className="field" style={{ marginTop: 8 }}>
            <label>Motif du refus (le vendeur le verra)</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. Photo floue, prix manquant…" autoFocus />
          </div>
        )}
      </div>
      <div className="vs-actions">
        {rejecting ? (
          <>
            <button className="btn sm danger-solid" disabled={busy} onClick={() => act("reject")}>Confirmer le refus</button>
            <button className="btn ghost sm" onClick={() => setRejecting(false)}>Annuler</button>
          </>
        ) : (
          <>
            <button className="btn sm" disabled={busy} onClick={() => act("approve")}>✓ Valider</button>
            <button className="btn ghost sm danger" disabled={busy} onClick={() => setRejecting(true)}>Refuser</button>
          </>
        )}
      </div>
      {big && (
        <div className="vs-zoom" onClick={() => setBig(null)} role="dialog">
          <img src={big} alt="" />
        </div>
      )}
    </div>
  );
}

function VendorForm({
  vendor,
  onCancel,
  onSaved,
}: {
  vendor?: VendorRow;
  onCancel: () => void;
  onSaved: (info: { name: string; whatsapp: string; password: string }) => void;
}) {
  const [name, setName] = useState(vendor?.name ?? "");
  const [whatsapp, setWhatsapp] = useState(vendor ? vendor.whatsapp.replace(/^223/, "") : "");
  const [password, setPassword] = useState(vendor ? "" : Math.random().toString(36).slice(2, 8));
  const [description, setDescription] = useState(vendor?.description ?? "");
  const [maxProducts, setMaxProducts] = useState(String(vendor?.maxProducts ?? 20));
  const [freeUntil, setFreeUntil] = useState(vendor ? vendor.freeUntil : inThreeMonths());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      whatsapp,
      description: description.trim(),
      maxProducts: parseInt(maxProducts, 10) || 20,
      freeUntil: freeUntil || null,
      ...(password ? { password } : {}),
    };
    const err = vendor ? await call(`/api/admin/vendeurs/${vendor.id}`, "PATCH", body) : await call("/api/admin/vendeurs", "POST", body);
    setBusy(false);
    if (err) setError(err);
    else onSaved({ name: body.name, whatsapp, password });
  }

  return (
    <form className="summary vs-form" onSubmit={save} style={{ marginTop: 12 }}>
      <h3 style={{ margin: 0 }}>{vendor ? `Modifier ${vendor.name}` : "Nouveau vendeur"}</h3>
      <div className="vs-row">
        <div className="field">
          <label>Nom de la boutique du vendeur</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Awa Chaussures" required />
        </div>
        <div className="field">
          <label>Son numéro WhatsApp</label>
          <input className="input" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Ex. 76 12 34 56" required />
        </div>
      </div>
      <div className="vs-row">
        <div className="field">
          <label>{vendor ? "Nouveau mot de passe (laisser vide pour garder)" : "Mot de passe (à lui envoyer)"}</label>
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} required={!vendor} minLength={6} />
        </div>
        <div className="field">
          <label>Produits maximum</label>
          <input className="input" inputMode="numeric" value={maxProducts} onChange={(e) => setMaxProducts(e.target.value)} />
        </div>
        <div className="field">
          <label>Gratuit jusqu'au</label>
          <input className="input" type="date" value={freeUntil} onChange={(e) => setFreeUntil(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Présentation (facultatif, visible sur sa page)</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. Chaussures femmes, livraison à Bamako" />
      </div>
      {error && <div className="error">{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" disabled={busy}>{busy ? "…" : vendor ? "Enregistrer" : "Créer le vendeur"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
