# Déploiement en production

Guide pas à pas pour mettre UnlockPro en ligne (exemple : **Vercel + Postgres**).
Comptez environ 1 h la première fois. Vérifiez l'état à tout moment via `GET /api/health`.

---

## 0. Pré-requis (comptes à créer)

| Service | Pour quoi | Coût au départ |
|---|---|---|
| **GitHub** | Héberger le code | Gratuit |
| **Vercel** | Héberger l'application | Gratuit → ~20 $/mo |
| **Postgres** (Neon / Supabase / Vercel Postgres) | Base de données | Gratuit → ~25 $/mo |
| **CinetPay** | Encaisser les paiements (Mobile Money + cartes) | Commission par transaction |
| **Grossiste DHRU** | Fournir codes & vérifications | Solde prépayé |
| **Resend** | Emails transactionnels | Gratuit → payant au volume |

---

## 1. Base de données Postgres

1. Créez une base chez **Neon**, **Supabase** ou **Vercel Postgres** et copiez l'URL de connexion (`postgresql://...`).
2. Dans `prisma/schema.prisma`, changez le provider :
   ```prisma
   datasource db {
     provider = "postgresql"   // etait "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. En local, pour créer le schéma sur cette base puis la remplir :
   ```bash
   DATABASE_URL="postgresql://..." npx prisma db push
   DATABASE_URL="postgresql://..." npm run db:seed
   ```
   (Sous PowerShell : `$env:DATABASE_URL="postgresql://..."; npx prisma db push`.)

> Migrations : pour un process plus rigoureux, remplacez `db push` par
> `npx prisma migrate deploy` et versionnez vos migrations.

---

## 2. CinetPay (paiements : Mobile Money + cartes)

1. Créez un **compte marchand CinetPay** (l'ouverture peut demander des documents
   d'entreprise : RCCM, RIB). Récupérez `CINETPAY_API_KEY` et `CINETPAY_SITE_ID`.
2. Dans votre compte CinetPay, déclarez l'**URL de notification** (`notify_url`) :
   `https://votre-domaine.com/api/cinetpay/notify`
3. Cette notification est la **source de vérité** : à sa réception, l'app reinterroge
   CinetPay (`/v2/payment/check`) puis déclenche le traitement de la commande. Au
   retour du client, la page de suivi reconfirme aussi le paiement (repli).

> Devise : CinetPay facture en **FCFA (XOF)**. Les prix (en EUR) sont convertis
> automatiquement (1 EUR = 655,957 XOF). Pour un affichage en FCFA avec des prix
> ronds, ajustez les tarifs depuis le back-office.

---

## 3. Fournisseur DHRU

1. Ouvrez un compte chez un grossiste exposant l'API **DHRU Fusion** et chargez un solde.
2. Récupérez `DHRU_API_URL`, `DHRU_USERNAME`, `DHRU_API_KEY`.
3. Renseignez, pour chaque service, son identifiant fournisseur `dhruServiceId`
   (back-office → Services, ou dans le seed) et passez `PROVIDER_MODE="live"`.

---

## 4. Resend (emails)

1. Créez un compte Resend, **vérifiez votre domaine** d'envoi.
2. Récupérez `RESEND_API_KEY` et définissez `EMAIL_FROM="UnlockPro <no-reply@votre-domaine.com>"`.

---

## 5. Déploiement sur Vercel

1. Poussez le code sur un dépôt GitHub.
2. Sur Vercel : **New Project** → importez le dépôt. Framework détecté : Next.js.
3. **Settings → Environment Variables** : ajoutez toutes les variables de
   [`.env.production.example`](.env.production.example) (valeurs réelles).
4. La commande de build (`prisma generate && next build`) est déjà configurée dans `package.json`.
5. Déployez. À la première mise en ligne, exécutez une fois `prisma db push` contre la base de prod (étape 1).
6. Pointez votre nom de domaine vers Vercel (Settings → Domains).

---

## 6. Secrets

Générez des secrets **uniques et aléatoires** (jamais les valeurs d'exemple) :

```bash
openssl rand -hex 32
```

Un par variable : `ADMIN_SESSION_SECRET`, `RESELLER_SESSION_SECRET`,
`CUSTOMER_SESSION_SECRET`, plus un vrai `ADMIN_PASSWORD`.
En production, **aucun mot de passe admin par défaut** : sans `ADMIN_PASSWORD`, l'accès `/admin` est impossible.

---

## 7. Vérification post-déploiement

Ouvrez `https://votre-domaine.com/api/health`. Visez :

```json
{ "ok": true, "db": "ok", "productionReady": true, "warnings": [] }
```

Chaque entrée de `warnings` signale une variable manquante ou un service encore en
mode simulation. `productionReady: true` = tout est branché.

**Checklist finale**
- [ ] `/api/health` → `productionReady: true`
- [ ] Un paiement test (carte réelle de faible montant) aboutit et la commande se traite
- [ ] L'email de résultat arrive bien
- [ ] Connexion `/admin` avec le mot de passe de production
- [ ] Création d'un revendeur + appel API `/api/v1/orders` avec sa clé
- [ ] `robots.txt` et `sitemap.xml` accessibles ; soumettez le sitemap à Google Search Console

---

## 8. Après le lancement

- **Pub** (Google / Meta) sur les requêtes à forte intention → trafic immédiat.
- Soumettez le site à **Google Search Console** et suivez l'indexation des pages `/services/*`.
- Surveillez `/api/health` avec un service d'uptime (UptimeRobot, Better Stack…).
- Sauvegardes régulières de la base Postgres.
