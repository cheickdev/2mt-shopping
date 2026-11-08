// Donnees de depart : parametres + quelques produits d'exemple.
// Lancez : npm run db:seed
import { PrismaClient } from "@prisma/client";

// tsx ne charge pas .env automatiquement : on le fait nous-memes.
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env");
} catch {
  /* ignore : DATABASE_URL peut deja etre defini dans l'environnement */
}

const prisma = new PrismaClient();

const PRODUCTS = [
  { name: "Escarpins vernis rouge", category: "CHAUSSURES", price: 15000, cost: 9000, stock: 8, sizes: "37,38,39,40", featured: true, description: "Escarpins élégants, talon 8 cm. Parfaits pour les sorties et cérémonies." },
  { name: "Baskets blanches tendance", category: "CHAUSSURES", price: 18000, cost: 11000, stock: 12, sizes: "38,39,40,41,42", featured: false, description: "Baskets confortables au quotidien, semelle souple." },
  { name: "Sérum éclat visage", category: "COSMETIQUES", price: 8000, cost: 4500, stock: 20, sizes: "", featured: true, description: "Sérum hydratant pour une peau lumineuse. Application matin et soir." },
  { name: "Rouge à lèvres mat (lot de 3)", category: "COSMETIQUES", price: 6000, cost: 3000, stock: 15, sizes: "Nude,Rouge,Bordeaux", featured: false, description: "Trois teintes longue tenue, fini mat." },
];

async function main() {
  await prisma.setting.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main", shopName: "2MT - Shopping", deliveryFee: 1000, partnerAPct: 60 },
  });

  for (const p of PRODUCTS) {
    const slug = p.name
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: { slug, ...p },
    });
  }
  console.log("Seed OK : parametres + " + PRODUCTS.length + " produits d'exemple.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
