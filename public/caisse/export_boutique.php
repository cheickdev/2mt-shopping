<?php
// Export des produits pour la boutique en ligne 2MT - Shopping.
// A placer dans le dossier de la caisse (ex. C:\wamp64\www\GestionAlimentation).
// Ouvrir cette page apres s'etre connecte a la caisse telecharge un fichier
// « produits-caisse-AAAA-MM-JJ.json » a envoyer dans l'admin du site :
// Produits > « Importer depuis la caisse ».
//
// Ce fichier s'adapte aux differentes versions de la caisse : il cherche
// lui-meme le fichier de connexion a la base, la table des produits et
// celle des categories.

error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED & ~E_WARNING);
ob_start(); // un fichier de config qui affiche du texte ne doit pas casser le telechargement

function eb_stop($title, $details = '')
{
    while (ob_get_level()) ob_end_clean();
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>Export boutique</title>';
    echo '<div style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:20px;border:1px solid #ddd;border-radius:12px">';
    echo '<h2 style="margin-top:0">' . htmlspecialchars($title) . '</h2>';
    if ($details) echo '<p>' . $details . '</p>';
    echo '<p style="color:#777;font-size:13px">Si le probleme continue, faites une capture de cette page et envoyez-la.</p></div>';
    exit();
}

// 1) Connexion a la base : on reutilise le fichier de configuration de la caisse.
$eb_configs = [
    'config/database.php', 'config/db.php', 'config/config.php', 'config/connexion.php',
    'includes/config.php', 'includes/db.php', 'includes/database.php', 'includes/connexion.php',
    'inc/config.php', 'inc/db.php', 'config.php', 'db.php', 'database.php', 'connexion.php', 'connect.php', 'conn.php',
];
foreach ($eb_configs as $eb_f) {
    if (is_file(__DIR__ . '/' . $eb_f)) {
        try {
            require_once __DIR__ . '/' . $eb_f;
        } catch (Throwable $e) {
            // on continue : une autre facon de se connecter peut marcher
        }
    }
}

$eb_db = null; // PDO ou mysqli
foreach (['pdo', 'db', 'bdd', 'conn', 'connexion', 'connection', 'con', 'link', 'mysqli', 'dbh', 'database'] as $eb_v) {
    if (isset($GLOBALS[$eb_v]) && ($GLOBALS[$eb_v] instanceof PDO || $GLOBALS[$eb_v] instanceof mysqli)) {
        $eb_db = $GLOBALS[$eb_v];
        break;
    }
}
if (!$eb_db) {
    foreach ($GLOBALS as $eb_val) {
        if ($eb_val instanceof PDO || $eb_val instanceof mysqli) { $eb_db = $eb_val; break; }
    }
}
if (!$eb_db) {
    // Constantes de connexion definies par la caisse (DB_HOST, DB_NAME…)
    $eb_host = defined('DB_HOST') ? DB_HOST : (defined('DB_SERVER') ? DB_SERVER : 'localhost');
    $eb_name = defined('DB_NAME') ? DB_NAME : (defined('DB_DATABASE') ? DB_DATABASE : null);
    $eb_user = defined('DB_USER') ? DB_USER : (defined('DB_USERNAME') ? DB_USERNAME : 'root');
    $eb_pass = defined('DB_PASS') ? DB_PASS : (defined('DB_PASSWORD') ? DB_PASSWORD : '');
    if ($eb_name) {
        try {
            $eb_db = new PDO("mysql:host=$eb_host;dbname=$eb_name;charset=utf8mb4", $eb_user, $eb_pass);
        } catch (Throwable $e) {
            $eb_db = null;
        }
    }
}
if (!$eb_db) {
    eb_stop("Connexion a la base introuvable", "Ce fichier doit etre place dans le dossier de la caisse, a cote de <b>products.php</b> ou <b>index.php</b>.");
}

// 2) Il faut etre connecte a la caisse.
if (session_status() === PHP_SESSION_NONE) @session_start();
$eb_logged = false;
foreach (['user_id', 'id_user', 'userid', 'id_utilisateur', 'utilisateur_id', 'user', 'username', 'utilisateur', 'login', 'logged_in', 'loggedin', 'admin', 'id', 'role', 'user_role'] as $eb_k) {
    if (!empty($_SESSION[$eb_k])) { $eb_logged = true; break; }
}
if (!$eb_logged && !empty($_SESSION)) $eb_logged = true; // autre version : une session existe
if (!$eb_logged) {
    eb_stop("Connectez-vous d'abord a la caisse", "Ouvrez la caisse, connectez-vous, puis rouvrez cette page.");
}
$eb_role = strtolower((string) ($_SESSION['user_role'] ?? $_SESSION['role'] ?? ''));
if (in_array($eb_role, ['cashier', 'caissier', 'caissiere', 'vendeur'], true)) {
    eb_stop("Acces reserve aux gerants", "Connectez-vous avec un compte administrateur ou gerant.");
}

// 3) Petites fonctions de lecture qui marchent avec PDO et mysqli.
function eb_rows($db, $sql)
{
    if ($db instanceof PDO) {
        $st = $db->query($sql);
        return $st ? $st->fetchAll(PDO::FETCH_ASSOC) : [];
    }
    $res = $db->query($sql);
    if (!$res) return [];
    $out = [];
    while ($r = $res->fetch_assoc()) $out[] = $r;
    return $out;
}
function eb_tables($db)
{
    $t = [];
    foreach (eb_rows($db, 'SHOW TABLES') as $r) $t[] = (string) reset($r);
    return $t;
}
function eb_find($tables, $wanted)
{
    $low = array_map('strtolower', $tables);
    foreach ($wanted as $w) {
        $i = array_search($w, $low, true);
        if ($i !== false) return $tables[$i];
    }
    return null;
}

try {
    $eb_tables = eb_tables($eb_db);
} catch (Throwable $e) {
    $eb_tables = [];
}
$eb_ptable = eb_find($eb_tables, ['products', 'produits', 'produit', 'product', 'articles', 'article', 'stock', 'stocks']);
if (!$eb_ptable) {
    eb_stop("Table des produits introuvable", "Tables trouvees : <b>" . htmlspecialchars(implode(', ', $eb_tables) ?: 'aucune') . "</b>");
}
$eb_ctable = eb_find($eb_tables, ['categories', 'categorie', 'category', 'categorys', 'famille', 'familles']);

// 4) Categories : id -> nom
$eb_cats = [];
if ($eb_ctable) {
    try {
        foreach (eb_rows($eb_db, "SELECT * FROM `$eb_ctable`") as $c) {
            $id = $c['id'] ?? $c['id_categorie'] ?? $c['categorie_id'] ?? $c['category_id'] ?? null;
            $nm = $c['name'] ?? $c['nom'] ?? $c['libelle'] ?? $c['designation'] ?? $c['categorie'] ?? null;
            if ($id !== null && $nm !== null) $eb_cats[(string) $id] = html_entity_decode((string) $nm, ENT_QUOTES, 'UTF-8');
        }
    } catch (Throwable $e) {
        $eb_cats = [];
    }
}

// 5) Produits : toutes les colonnes utiles (le site reconnait les noms courants :
// name/nom/designation, selling_price/prix_vente, purchase_price/prix_achat…).
try {
    $eb_list = eb_rows($eb_db, "SELECT * FROM `$eb_ptable`");
} catch (Throwable $e) {
    eb_stop("Lecture des produits impossible", htmlspecialchars($e->getMessage()));
}

$eb_products = [];
foreach ($eb_list as $row) {
    $p = [];
    foreach ($row as $k => $v) {
        if ($v === null) continue;
        if (is_string($v)) {
            if (strlen($v) > 3000) continue; // images enregistrees dans la base : inutiles ici
            $v = html_entity_decode($v, ENT_QUOTES, 'UTF-8');
        }
        $p[$k] = $v;
    }
    $catId = $row['category_id'] ?? $row['categorie_id'] ?? $row['id_categorie'] ?? $row['id_category'] ?? null;
    if ($catId !== null && isset($eb_cats[(string) $catId])) $p['category_name'] = $eb_cats[(string) $catId];
    $eb_products[] = $p;
}

while (ob_get_level()) ob_end_clean();
$file = 'produits-caisse-' . date('Y-m-d') . '.json';
header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $file . '"');
echo json_encode(
    [
        'source' => 'alimentation-tounkara',
        'exportedAt' => date('c'),
        'table' => $eb_ptable,
        'products' => $eb_products,
    ],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR
);
