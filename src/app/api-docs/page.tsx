import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation API",
  description: "Reference de l'API REST UnlockPro v1 : authentification, endpoints, quotas et codes d'erreur.",
  alternates: { canonical: "/api-docs" },
};

const CODE = {
  order: `curl -X POST https://votre-domaine.com/api/v1/orders \\
  -H "Authorization: Bearer VOTRE_CLE_API" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"blacklist-status","imei":"356938035643809"}'`,
  orderRes: `{
  "ok": true,
  "order": {
    "publicId": "UP-9EDLDK",
    "service": "Statut Blacklist (perdu / vole)",
    "imei": "356938035643809",
    "status": "DELIVERED",
    "priceCents": 39,
    "currency": "EUR",
    "result": "Statut Blacklist : PROPRE (non signale)",
    "errorMessage": null
  }
}`,
  services: `curl https://votre-domaine.com/api/v1/services \\
  -H "Authorization: Bearer VOTRE_CLE_API"`,
  account: `curl https://votre-domaine.com/api/v1/account \\
  -H "Authorization: Bearer VOTRE_CLE_API"`,
  status: `curl https://votre-domaine.com/api/v1/orders/UP-9EDLDK \\
  -H "Authorization: Bearer VOTRE_CLE_API"`,
};

function Endpoint({
  method, path, children,
}: { method: string; path: string; children: React.ReactNode }) {
  const color = method === "POST" ? "var(--brand-2)" : "var(--brand)";
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span className="mono" style={{ color, fontWeight: 800 }}>{method}</span>
        <span className="mono">{path}</span>
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

export default function ApiDocs() {
  return (
    <main style={{ paddingBottom: 48, maxWidth: 820, margin: "0 auto" }}>
      <section className="hero" style={{ paddingBottom: 20 }}>
        <div className="badge">API REST v1</div>
        <h1>Documentation API</h1>
        <p>Automatisez vos verifications IMEI et deblocages. Facturation a l&apos;usage sur votre portefeuille prepaye.</p>
      </section>

      <h2 className="section-title">Authentification</h2>
      <p className="section-sub">Chaque requete porte votre cle API dans l&apos;en-tete <code>Authorization</code>.</p>
      <div className="result-box">Authorization: Bearer VOTRE_CLE_API</div>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        Recuperez votre cle dans votre <a href="/reseller">espace revendeur</a>. Gardez-la secrete : elle donne acces a votre solde.
      </p>

      <h2 className="section-title">Base URL</h2>
      <div className="result-box">https://votre-domaine.com/api/v1</div>

      <h2 className="section-title">Quotas (limitation de debit)</h2>
      <p className="section-sub">
        Chaque compte a une limite de requetes par minute (par defaut 60, ajustable). Chaque reponse renvoie :
      </p>
      <div className="result-box">{`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1730880000`}</div>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        En cas de depassement : reponse <strong>429</strong> avec un en-tete <code>Retry-After</code> (secondes a attendre).
      </p>

      <h2 className="section-title">Endpoints</h2>

      <Endpoint method="GET" path="/api/v1/account">
        <p style={{ margin: "0 0 8px" }}>Solde, marge et quota de votre compte.</p>
        <div className="result-box">{CODE.account}</div>
      </Endpoint>

      <Endpoint method="GET" path="/api/v1/services">
        <p style={{ margin: "0 0 8px" }}>Catalogue des services actifs, avec votre prix revendeur.</p>
        <div className="result-box">{CODE.services}</div>
      </Endpoint>

      <Endpoint method="POST" path="/api/v1/orders">
        <p style={{ margin: "0 0 8px" }}>
          Place une commande. Corps JSON : <code>service</code> (slug) et <code>imei</code>.
          Le prix est debite de votre portefeuille ; remboursement automatique en cas d&apos;echec fournisseur.
        </p>
        <div className="result-box">{CODE.order}</div>
        <p style={{ margin: "12px 0 6px", color: "var(--muted)", fontSize: 14 }}>Reponse :</p>
        <div className="result-box">{CODE.orderRes}</div>
      </Endpoint>

      <Endpoint method="GET" path="/api/v1/orders/:publicId">
        <p style={{ margin: "0 0 8px" }}>Statut et resultat d&apos;une de vos commandes.</p>
        <div className="result-box">{CODE.status}</div>
      </Endpoint>

      <h2 className="section-title">Codes d&apos;erreur</h2>
      <table className="table">
        <thead><tr><th>Code</th><th>Signification</th></tr></thead>
        <tbody>
          <tr><td className="mono">200</td><td>Succes</td></tr>
          <tr><td className="mono">400</td><td>Requete invalide (IMEI ou champs manquants/incorrects)</td></tr>
          <tr><td className="mono">401</td><td>Cle API invalide ou absente</td></tr>
          <tr><td className="mono">402</td><td>Solde insuffisant — rechargez votre portefeuille</td></tr>
          <tr><td className="mono">404</td><td>Service ou commande introuvable</td></tr>
          <tr><td className="mono">429</td><td>Quota depasse — voir l&apos;en-tete Retry-After</td></tr>
        </tbody>
      </table>

      <p className="note" style={{ marginTop: 32 }}>
        Besoin d&apos;un quota plus eleve ou d&apos;un service specifique ? Contactez l&apos;equipe depuis votre espace revendeur.
      </p>
    </main>
  );
}
