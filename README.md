# UnlockPro

Plateforme de **vérification IMEI** et de **déblocage réseau par IMEI**, pensée pour
générer du revenu en ligne sans stock, partout dans le monde.

Le projet tourne **immédiatement en mode simulation** : aucune clé, aucun compte
fournisseur ni paiement nécessaire pour tout tester. Vous branchez le réel ensuite.

## Ce qui est inclus (Phase 1)

- Catalogue de services : vérifications IMEI (iCloud/Find My, blacklist, opérateur, rapport complet) et déblocages réseau (iPhone, Samsung, Xiaomi).
- Validation d'IMEI robuste (longueur + algorithme de Luhn).
- Prise de commande + page de suivi de statut en temps réel.
- **Paiement CinetPay** (Mobile Money Orange/Moov + cartes, Afrique de l'Ouest) : page de paiement hébergée + **notification** serveur-à-serveur qui déclenche le traitement après encaissement, avec repli de confirmation au retour. Les prix sont en EUR et convertis en FCFA (XOF) au paiement (parité fixe).
- Connecteur fournisseur **DHRU Fusion** avec deux modes : `simulation` et `live`.
- Gestion des prix et des marges (prix de vente vs coût fournisseur).
- **Back-office admin** (`/admin`) : tableau de bord (CA, marge, commandes), édition des services (prix/marges/délais/disponibilité), création de services, gestion des commandes (relance d'un échec, passage en remboursé).
- **Tier revendeurs + API publique** (revenus récurrents) : comptes revendeurs avec **portefeuille prépayé**, **clé API**, tableau de bord (`/reseller`), et **API REST v1** facturée à l'usage (chaque commande débite le portefeuille au prix revendeur = coût + votre marge ; remboursement automatique si le fournisseur échoue).
- **Espace client grand public** (`/account`) : inscription / connexion (email + mot de passe haché scrypt), **réinitialisation de mot de passe** (lien par email, token haché, expiration 1 h), historique des commandes avec statut et résultats. Les commandes web passées en étant connecté sont rattachées au compte ; l'email est pré-rempli.
- **SEO** : pages dédiées par service (`/services/[slug]`) avec métadonnées (title, description, OpenGraph, canonical), **données structurées JSON-LD** (Service + FAQ pour les *rich results* Google), `sitemap.xml` et `robots.txt` générés automatiquement.
- **Emails transactionnels** : bienvenue à l'inscription, résultat de commande (code de déblocage / rapport, ou échec), réinitialisation de mot de passe. Via **Resend** si configuré, sinon simulé (journalisé en console).

Deux interrupteurs **indépendants**, chacun piloté par la simple présence d'une clé :
- **Paiement** : sans identifiants CinetPay → simulé (commande payée instantanément) ; avec `CINETPAY_API_KEY` + `CINETPAY_SITE_ID` → vrai paiement CinetPay.
- **Fournisseur** : `PROVIDER_MODE=simulation` → résultats fabriqués ; `live` → API DHRU réelle.

## Prérequis

- Node.js 18.18+ (20+ recommandé).

## Démarrage (mode simulation)

```bash
npm install
cp .env.example .env          # Windows PowerShell : copy .env.example .env
npm run db:push               # cree la base SQLite locale
npm run db:seed               # insere les services de demonstration
npm run dev                   # http://localhost:3000
```

Saisissez un IMEI valide de test (15 chiffres, Luhn correct), par exemple
`490154203237518`, choisissez un service, un email, et lancez la commande : le
résultat est généré instantanément.

## Passer en production

> **Guide complet pas à pas : [DEPLOYMENT.md](DEPLOYMENT.md)** (Vercel + Postgres + CinetPay + DHRU + Resend).
> Variables de production : [`.env.production.example`](.env.production.example).
> Après déploiement, vérifiez l'état via **`GET /api/health`** (`productionReady: true` = tout est branché).
> En production, aucun mot de passe admin par défaut : définissez `ADMIN_PASSWORD` et des secrets de session uniques.

Résumé des branchements :

1. **Base de données** : dans `prisma/schema.prisma`, remplacez `provider = "sqlite"`
   par `"postgresql"` et mettez `DATABASE_URL` vers votre Postgres. Relancez `npm run db:push`.
2. **Fournisseur de codes** : ouvrez un compte chez un grossiste exposant l'API
   **DHRU Fusion**. Dans `.env` : `PROVIDER_MODE="live"`, puis `DHRU_API_URL`,
   `DHRU_USERNAME`, `DHRU_API_KEY`. Renseignez le `dhruServiceId` de chaque service
   (dans le seed ou via le futur back-office).
3. **Paiement (CinetPay)** : créez un compte marchand CinetPay (Mobile Money
   Orange/Moov + cartes). Dans `.env` : `CINETPAY_API_KEY` et `CINETPAY_SITE_ID`.
   Dès que les deux sont présents, la prise de commande redirige vers la page de
   paiement CinetPay. Les prix (en EUR) sont convertis en FCFA (XOF) au paiement.

   **Notification** (`notify_url`, indispensable en production — c'est elle qui
   déclenche le traitement après encaissement) : déclarez dans votre compte CinetPay
   l'URL `https://votre-domaine/api/cinetpay/notify`. Au retour du client, la page de
   suivi reconfirme aussi le paiement (repli via `/api/order/confirm?order=...`).

## Back-office admin

Accès : `http://localhost:3000/admin` → mot de passe (par défaut `admin` en dev ;
définissez `ADMIN_PASSWORD` et `ADMIN_SESSION_SECRET` en production).

- **Tableau de bord** : chiffre d'affaires, marge, nombre de commandes, livrées, échecs, remboursées, et les modes actifs (paiement / fournisseur).
- **Services** : ajuster prix, coût (→ marge recalculée en direct), délai, identifiant fournisseur (`dhruServiceId`) et activer/désactiver ; créer de nouveaux services.
- **Commandes** : voir le détail (résultat livré / erreur), **relancer** une commande en échec, **rembourser** (passage en `REFUNDED` ; le remboursement effectif Mobile Money/carte se fait côté CinetPay).

## Revendeurs & API publique (revenus récurrents)

Le modèle qui crée du **MRR** : des revendeurs (petites boutiques, autres sites)
rechargent un **portefeuille prépayé** et consomment vos services par **API**.
Chaque appel débite leur solde au **prix revendeur** = coût fournisseur + votre marge
(configurable par revendeur, 30 % par défaut). Vous encaissez d'avance et gardez la marge.

**Créer un revendeur** : back-office → **Revendeurs** → « Nouveau revendeur ». La clé
API s'affiche **une seule fois** ; communiquez-la au revendeur.

**Tableau de bord revendeur** : `http://localhost:3000/reseller` → connexion avec la clé API.
Solde, recharge (crédit immédiat en simulation ; en prod, crédit par l'admin pour l'instant), clé API, historique,
mouvements de portefeuille.

**Documentation** : page publique **`/api-docs`** (endpoints, exemples, quotas, codes d'erreur).

**Quotas** : chaque revendeur a une **limite de requêtes par minute** (60 par défaut, ajustable dans le back-office). Les réponses portent les en-têtes `X-RateLimit-Limit` / `-Remaining` / `-Reset` ; au-delà, réponse `429` avec `Retry-After`. Le rate limiter est en mémoire (adapté à un serveur unique) ; pour du serverless multi-instances, le remplacer par Redis/Upstash (interface inchangée).

**API REST v1** (authentification : en-tête `Authorization: Bearer <cle_api>`) :

| Méthode | Endpoint | Rôle |
|---|---|---|
| GET  | `/api/v1/account`      | Solde et infos du compte |
| GET  | `/api/v1/services`     | Catalogue au prix revendeur |
| POST | `/api/v1/orders`       | Passer une commande (`{ "service": "slug", "imei": "..." }`) |
| GET  | `/api/v1/orders/:id`   | Statut / résultat d'une commande |

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -d '{"service":"blacklist-status","imei":"356938035643809"}'
```

Solde insuffisant → `402`. Échec fournisseur → la commande passe en `FAILED` et le
portefeuille est **recrédité automatiquement**.

## Structure

```
prisma/schema.prisma      Modele de donnees (Service, Order)
prisma/seed.ts            Services de demonstration
src/lib/imei.ts           Validation IMEI (Luhn)
src/lib/pricing.ts        Formatage prix + marges
src/lib/providers/dhru.ts Connecteur fournisseur (simulation / live)
src/lib/cinetpay.ts       Integration CinetPay (init paiement + verification)
src/lib/orders.ts         Logique metier des commandes (paiement + traitement)
src/app/api/order         POST : creer une commande (-> Checkout en live)
src/app/api/order/confirm GET  : confirmer le paiement au retour de CinetPay
src/app/api/orders/[id]   GET  : statut d'une commande
src/app/api/cinetpay/notify POST : notification CinetPay (paiement confirme)
src/lib/admin-auth.ts     Auth admin (mot de passe + cookie HMAC)
src/lib/reseller-auth.ts  Auth revendeur (cle API + cookie de session)
src/app/admin             Back-office (dashboard, services, commandes, revendeurs)
src/app/api/admin         API admin (login, services, commandes, revendeurs)
src/app/reseller          Tableau de bord revendeur (solde, cle API, recharge)
src/app/api/reseller      API web revendeur (login, recharge)
src/app/api/v1            API publique REST (services, orders, account)
src/lib/api-auth.ts       Auth API + quota (en-tetes X-RateLimit, 429)
src/lib/rate-limit.ts     Limiteur de debit (fenetre glissante en memoire)
src/app/api-docs          Documentation API publique
src/lib/customer-auth.ts  Auth client (scrypt + cookie de session)
src/app/account           Espace client (connexion, inscription, commandes)
src/app/api/account       API client (register, login, logout)
src/lib/email.ts          Emails transactionnels (Resend / simulation)
src/app/services/[slug]   Pages SEO par service (metadonnees + JSON-LD)
src/app/sitemap.ts        sitemap.xml (accueil + pages services)
src/app/robots.ts         robots.txt
src/app/page.tsx          Accueil + catalogue + formulaire
src/app/order/[id]        Page de suivi
```

## Feuille de route (prochaines étapes)

- Rate limiter partagé (Redis/Upstash) pour le serverless multi-instances.
- Email de confirmation d'inscription, notifications revendeur (solde bas).
- Blog / pages de contenu SEO par modèle et opérateur, multilingue.
