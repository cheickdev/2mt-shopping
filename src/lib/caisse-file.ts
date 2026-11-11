// Lecture du fichier d'export de la caisse « Alimentation Tounkara ».
// Formats acceptes :
//  - le fichier de la page export_boutique.php de la caisse (JSON) ;
//  - un export phpMyAdmin de la table `products` (CSV ou JSON).
// Utilisable cote navigateur (aucune dependance serveur).

export const MAX_CAISSE_PRODUCTS = 15_000;

export interface CaisseRow {
  ref: string; // identifiant stable : code-barres, sinon "id-<id>"
  barcode: string;
  name: string;
  category: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  unit: string;
}

type Raw = Record<string, unknown>;

// Noms de colonnes possibles pour chaque information.
const KEYS = {
  id: ["id", "product_id", "id_produit", "produit_id", "idproduit", "id_article", "article_id"],
  barcode: ["barcode", "code_barre", "codebarre", "code_barres", "codebarres", "ean", "code"],
  name: ["name", "nom", "product_name", "designation", "libelle", "nom_produit", "libelle_produit", "designation_produit", "produit", "article"],
  description: ["description", "details"],
  category: ["category", "category_name", "categorie", "categorie_nom", "libelle_categorie", "nom_categorie", "famille"],
  categoryId: ["category_id", "categorie_id", "id_categorie", "id_category", "famille_id", "id_famille"],
  price: ["price", "selling_price", "prix", "prix_vente", "prix_de_vente", "prix_unitaire", "prix_vente_unitaire", "pu", "prix_detail"],
  cost: ["cost", "cost_price", "purchase_price", "prix_achat", "prix_d_achat", "prix_achat_unitaire", "pa", "cout"],
  stock: ["stock", "stock_quantity", "quantite", "quantity", "qte", "quantite_stock", "stock_actuel", "qte_stock", "quantite_en_stock"],
  unit: ["unit", "unite"],
  active: ["is_active", "active", "actif"],
};

const normKey = (k: string) =>
  k
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

function pick(r: Raw, keys: string[]): unknown {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k];
  return undefined;
}

/** Les noms de la caisse sont parfois enregistres avec des codes HTML (&amp;, &#039;…). */
function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const text = (v: unknown, max: number) => decodeHtml(String(v ?? "").trim()).replace(/\s+/g, " ").slice(0, max);
const textKeepLines = (v: unknown, max: number) => decodeHtml(String(v ?? "").trim()).slice(0, max);

function money(v: unknown): number {
  if (typeof v === "number") return Math.max(0, Math.round(v));
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
function int(v: unknown): number {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function isInactive(v: unknown): boolean {
  if (v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return s === "0" || s === "false" || s === "non";
}

function toRow(raw: Raw): CaisseRow | null {
  const r: Raw = {};
  for (const [k, v] of Object.entries(raw)) r[normKey(k)] = v;
  if (isInactive(pick(r, KEYS.active))) return null;
  const name = text(pick(r, KEYS.name), 200);
  if (!name) return null;
  const barcode = text(pick(r, KEYS.barcode), 80).replace(/\s/g, "");
  const id = text(pick(r, KEYS.id), 40);
  // Reference stable : fournie par l'export de la caisse, sinon code-barres, sinon numero.
  const ref = text(r.ref, 80) || barcode || (id ? `id-${id}` : `nom-${normKey(name)}`.slice(0, 80));
  const catId = text(pick(r, KEYS.categoryId), 20);
  return {
    ref,
    barcode,
    name,
    category: text(pick(r, KEYS.category), 100) || (catId ? `Catégorie ${catId}` : "") || guessCategory(name),
    description: textKeepLines(pick(r, KEYS.description), 2000),
    price: money(pick(r, KEYS.price)),
    cost: money(pick(r, KEYS.cost)),
    stock: int(pick(r, KEYS.stock)),
    unit: text(pick(r, KEYS.unit), 30),
  };
}

// La caisse n'a pas de categories : on en propose une d'apres le nom du produit
// (a verifier a l'import). L'ordre compte : la 1re regle qui correspond gagne.
const CATEGORY_RULES: [string, RegExp][] = [
  ["Électronique", /\b(adapt(er|ateur)|chargeur|charger|cable|câble|usb|ecouteur|écouteur|earphone|batterie|pile|piles|ampoule|lampe|torche|power bank|telephone|téléphone|radio)\b/i],
  ["Entretien", /\b(javel|detergent|détergent|lessive|omo|ariel|savon en poudre|insecticide|moustiquaire|air ?fresh|desodorisant|désodorisant|eponge|éponge|serpilliere|balai)\b/i],
  ["Cosmétiques", /\b(eau de cologne|cologne|sulfur|lotion|creme|crème|cream|pommade|vaseline|savon|soap|gel douche|shower|shampo\w*|apres[- ]shampo|déo|deo|deodorant|déodorant|parfum|perfume|eau de toilette|body|lait corporel|huile corporelle|dentifrice|colgate|signal|brosse a dent|coton|rasoir|gillette|lingette|couche|pampers|serviette hygien\w*|always|maquillage|vernis|mèche|meche|tissage|perruque|défrisant|defrisant)\b/i],
  ["Boissons", /\b(energy|jus|juice|eau|water|soda|coca|fanta|sprite|pepsi|malta|bissap|gingembre|youki|boisson|drink|cafe|café|nescafe|nescafé|lipton|the|thé|tea|sirop|bière|biere|vimto)\b/i],
  ["Alimentation", /\b(riz|sucre|huile|farine|pate|pâte|pates|pâtes|spaghetti|macaroni|tomate|concentre|concentré|mayonnaise|ketchup|moutarde|sel|maggi|jumbo|cube|sardine|thon|biscuit|chocolat|bonbon|chips|lait|nido|cereale|céréale|corn ?flakes|confiture|miel|beurre|fromage|yaourt|oeuf|œuf|pain|semoule|couscous|vermicelle|lentille|haricot|arachide|cacahuete|epice|épice|poivre|piment|vinaigre|sauce)\b/i],
];
export function guessCategory(name: string): string {
  const plain = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) if (re.test(plain)) return cat;
  return "";
}

/** Decoupe un CSV (separateur ; , ou tabulation, guillemets "…" geres). */
function parseCsv(src: string): Raw[] {
  const nl = src.indexOf("\n");
  const firstLine = nl < 0 ? src : src.slice(0, nl);
  const counts = [";", ",", "\t"].map((c) => [c, firstLine.split(c).length] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/** Trouve la liste de produits dans un JSON (notre export, tableau, ou export phpMyAdmin). */
function jsonRows(data: unknown): Raw[] {
  if (Array.isArray(data)) {
    // Export phpMyAdmin : [{type:"header"}, {type:"table", name:"products", data:[…]}]
    const tables = data.filter((x): x is Raw => !!x && typeof x === "object" && (x as Raw).type === "table");
    if (tables.length) {
      const t = tables.find((x) => String(x.name).toLowerCase() === "products") ?? tables[0];
      return Array.isArray(t.data) ? (t.data as Raw[]) : [];
    }
    return data.filter((x): x is Raw => !!x && typeof x === "object");
  }
  if (data && typeof data === "object") {
    const o = data as Raw;
    for (const k of ["products", "produits", "data", "items"]) if (Array.isArray(o[k])) return jsonRows(o[k]);
  }
  return [];
}

/** Lit le contenu du fichier et renvoie les produits (actifs) trouves. */
export function parseCaisseFile(content: string): CaisseRow[] {
  const src = content.replace(/^﻿/, "").trim();
  let raws: Raw[];
  if (src.startsWith("{") || src.startsWith("[")) {
    try {
      raws = jsonRows(JSON.parse(src));
    } catch {
      throw new Error("Fichier JSON abîmé : refaites l'export depuis la caisse.");
    }
  } else raws = parseCsv(src);
  const rows = raws.map(toRow).filter((r): r is CaisseRow => !!r);
  if (!rows.length) throw new Error("Aucun produit trouvé dans ce fichier. Est-ce bien l'export des produits de la caisse ?");
  if (rows.length > MAX_CAISSE_PRODUCTS) throw new Error(`Trop de produits (${rows.length}). Maximum : ${MAX_CAISSE_PRODUCTS}.`);
  return rows;
}
