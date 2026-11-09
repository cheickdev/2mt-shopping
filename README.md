# 2MT - Shopping

Boutique en ligne (chaussures & cosmétiques) pour Bamako. Commande en ligne,
**paiement à la livraison**, bouton WhatsApp, et tableau de bord pour les
associés (produits, commandes, bénéfice et partage 60/40).

Stack : Next.js 15 (App Router) · TypeScript · Prisma · SQLite (dev) / Postgres (prod).

## Lancer en local

```bash
npm install            # (ou réutiliser des node_modules compatibles)
node prisma/init-db.cjs   # crée la base SQLite locale + données d'exemple
npm run dev
```

Boutique : http://localhost:3000 · Tableau de bord : http://localhost:3000/admin
(mot de passe par défaut en dev : `2mt-admin`).

## Déploiement (Vercel + Neon)

Comme pour une appli Next.js standard :

1. Passer `provider = "postgresql"` dans `prisma/schema.prisma`.
2. Créer une base Postgres (Neon) et récupérer son `DATABASE_URL`.
3. Variables d'environnement sur Vercel :
   - `DATABASE_URL` (Postgres Neon)
   - `ADMIN_PASSWORD` (mot de passe du tableau de bord — **à changer**)
   - `ADMIN_SESSION_SECRET` (chaîne aléatoire)
   - `NEXT_PUBLIC_SITE_URL` (ex. `https://2mt-shopping.vercel.app`)
4. Pousser le code sur GitHub, importer le repo dans Vercel, déployer.
5. Après le 1er déploiement, initialiser le schéma Postgres (`prisma db push`).

## Réglages (dans /admin → Paramètres)

- **Numéro WhatsApp** des commandes (format international, ex. `223XXXXXXXX`).
- **Frais de livraison** Bamako.
- **Partage du bénéfice** (part associé A, le reste pour B).
- **Budget pub** du mois (déduit du bénéfice net).

## À venir (V2)

- Paiement en ligne Mobile Money (Orange/Moov via CinetPay).
- Comptes clients, historique, parrainage.
- Notifications automatiques.

## Import de produits depuis eBay (optionnel)

eBay refuse la lecture directe de ses pages par un serveur. L'import passe donc
par l'API officielle d'eBay (gratuite) :

1. Créer un compte sur https://developer.ebay.com et une application (« Production »).
2. Récupérer l'**App ID (Client ID)** et le **Cert ID (Client Secret)**.
3. Sur Vercel → Settings → Environment Variables, ajouter :
   - `EBAY_CLIENT_ID` = App ID
   - `EBAY_CLIENT_SECRET` = Cert ID
   - `EBAY_MARKETPLACE` (optionnel) = `EBAY_US` (défaut), `EBAY_FR`, `EBAY_GB`…
4. Redéployer. Les liens `ebay.com/itm/…` s'importent alors avec photos et variétés.
