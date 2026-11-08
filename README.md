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
