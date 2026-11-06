// Jeu de services de demonstration.
// Les prix (priceCents) sont ceux factures au client ; les couts (costCents)
// representent le tarif fournisseur estime -> la difference est votre marge.
// Ajustez librement depuis le back-office admin une fois en place.

import { PrismaClient } from "@prisma/client";

// tsx ne charge pas automatiquement le .env (contrairement au CLI Prisma).
// On le charge donc nous-memes si DATABASE_URL n'est pas deja defini.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    process.env.DATABASE_URL = "file:./prisma/dev.db";
  }
}

const prisma = new PrismaClient();

const services = [
  // --- Verifications IMEI (instantanees, forte marge) -----------------------
  {
    slug: "icloud-fmi-status",
    name: "Statut iCloud / Localiser (Find My)",
    type: "CHECK",
    category: "Apple",
    description:
      "Indique si l'iPhone est verrouille a un compte iCloud et si « Localiser » est actif. Indispensable avant d'acheter un iPhone d'occasion.",
    priceCents: 299,
    costCents: 20,
    estimatedTime: "Instantane",
    dhruServiceId: null,
  },
  {
    slug: "blacklist-status",
    name: "Statut Blacklist (perdu / vole)",
    type: "CHECK",
    category: "Blacklist",
    description:
      "Verifie si l'appareil est declare perdu, vole ou bloque aupres des operateurs. A faire systematiquement sur le marche de l'occasion.",
    priceCents: 399,
    costCents: 30,
    estimatedTime: "Instantane",
    dhruServiceId: null,
  },
  {
    slug: "carrier-lock-status",
    name: "Statut de verrouillage operateur (SIM-lock)",
    type: "CHECK",
    category: "Reseau",
    description:
      "Indique l'operateur d'origine et si l'appareil est verrouille sur un reseau.",
    priceCents: 249,
    costCents: 15,
    estimatedTime: "Instantane",
    dhruServiceId: null,
  },
  {
    slug: "full-info-check",
    name: "Rapport complet de l'appareil",
    type: "CHECK",
    category: "Apple",
    description:
      "Modele, capacite, couleur, date d'activation, garantie, blacklist et statut iCloud reunis dans un seul rapport.",
    priceCents: 599,
    costCents: 45,
    estimatedTime: "Instantane",
    dhruServiceId: null,
  },

  // --- Deblocages reseau (ticket plus eleve) --------------------------------
  {
    slug: "unlock-iphone-generic",
    name: "Deblocage reseau iPhone (tout operateur)",
    type: "UNLOCK",
    category: "Apple",
    description:
      "Deblocage definitif de l'iPhone par IMEI via les serveurs Apple. Compatible mises a jour.",
    priceCents: 2999,
    costCents: 1800,
    estimatedTime: "1-72h",
    dhruServiceId: null,
  },
  {
    slug: "unlock-samsung",
    name: "Deblocage reseau Samsung",
    type: "UNLOCK",
    category: "Samsung",
    description:
      "Code de deblocage reseau pour la plupart des modeles Samsung, par IMEI.",
    priceCents: 1999,
    costCents: 900,
    estimatedTime: "1-24h",
    dhruServiceId: null,
  },
  {
    slug: "unlock-xiaomi",
    name: "Deblocage reseau Xiaomi",
    type: "UNLOCK",
    category: "Xiaomi",
    description: "Deblocage reseau par IMEI pour les modeles Xiaomi eligibles.",
    priceCents: 1799,
    costCents: 800,
    estimatedTime: "1-48h",
    dhruServiceId: null,
  },
];

async function main() {
  console.log("Seed : insertion des services de demonstration...");
  for (const s of services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: { ...s, currency: "EUR", active: true },
      create: { ...s, currency: "EUR", active: true },
    });
    console.log(`  + ${s.name}`);
  }
  console.log("Seed termine.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
