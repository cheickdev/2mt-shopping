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
$eb_found_files = [];
foreach ($eb_configs as $eb_f) if (is_file(__DIR__ . '/' . $eb_f)) $eb_found_files[] = $eb_f;

function eb_is_db($x)
{
    return $x instanceof PDO || $x instanceof mysqli;
}

// a) Une variable globale deja connectee ($pdo, $conn, $db…)
foreach ($GLOBALS as $eb_val) {
    if (eb_is_db($eb_val)) { $eb_db = $eb_val; break; }
}

// b) Une classe de connexion (ex. class Database { getConnection() })
$eb_classes = [];
if (!$eb_db) {
    $eb_methods = ['getConnection', 'getconnection', 'connect', 'getPdo', 'getPDO', 'getDb', 'getDB', 'getConnexion', 'connexion', 'getInstance', 'instance', 'get'];
    foreach (get_declared_classes() as $eb_c) {
        try {
            $rc = new ReflectionClass($eb_c);
            if (!$rc->isUserDefined() || $rc->isAbstract()) continue;
            $eb_classes[] = $eb_c;
            foreach ($eb_methods as $m) {
                if (!$rc->hasMethod($m)) continue;
                $rm = $rc->getMethod($m);
                if (!$rm->isPublic() || $rm->getNumberOfRequiredParameters() > 0) continue;
                $res = null;
                if ($rm->isStatic()) {
                    $res = $rm->invoke(null);
                } else {
                    $ctor = $rc->getConstructor();
                    if ($ctor && $ctor->getNumberOfRequiredParameters() > 0) continue;
                    $res = $rm->invoke($rc->newInstance());
                }
                if (is_object($res) && !eb_is_db($res)) {
                    // getInstance() renvoie parfois l'objet : on cherche la connexion dedans
                    foreach (['getConnection', 'connect', 'getPdo', 'getDb'] as $m2) {
                        if (method_exists($res, $m2)) { try { $r2 = $res->$m2(); if (eb_is_db($r2)) { $res = $r2; break; } } catch (Throwable $e) {} }
                    }
                    foreach (get_object_vars($res) as $pv) if (eb_is_db($pv)) { $res = $pv; break; }
                }
                if (eb_is_db($res)) { $eb_db = $res; break 2; }
            }
        } catch (Throwable $e) {
            // on essaie la suivante
        }
    }
}

// c) Une fonction de connexion (ex. getDB(), connect())
if (!$eb_db) {
    foreach (get_defined_functions()['user'] as $eb_fn) {
        if (strpos($eb_fn, 'eb_') === 0 || !preg_match('/(db|pdo|conn|connect|connexion|database|bdd)/i', $eb_fn)) continue;
        try {
            $rf = new ReflectionFunction($eb_fn);
            if ($rf->getNumberOfRequiredParameters() > 0) continue;
            $res = $rf->invoke();
            if (eb_is_db($res)) { $eb_db = $res; break; }
        } catch (Throwable $e) {
        }
    }
}

// d) Identifiants ecrits dans les fichiers de configuration
function eb_try_pdo($host, $name, $user, $pass)
{
    try {
        $dsn = 'mysql:host=' . $host . ($name ? ';dbname=' . $name : '') . ';charset=utf8mb4';
        $p = new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 3]);
        $p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $p;
    } catch (Throwable $e) {
        return null;
    }
}
$eb_cred = ['host' => 'localhost', 'name' => null, 'user' => 'root', 'pass' => ''];
if (!$eb_db) {
    foreach (['DB_HOST' => 'host', 'DB_SERVER' => 'host', 'DB_NAME' => 'name', 'DB_DATABASE' => 'name', 'DB_USER' => 'user', 'DB_USERNAME' => 'user', 'DB_PASS' => 'pass', 'DB_PASSWORD' => 'pass'] as $k => $f) {
        if (defined($k)) $eb_cred[$f] = constant($k);
    }
    foreach ($eb_found_files as $eb_f) {
        $src = (string) @file_get_contents(__DIR__ . '/' . $eb_f);
        $grab = function ($names) use ($src) {
            foreach ($names as $n) {
                // $host = 'x'; private $db_name = "x"; 'dbname' => 'x'; define('DB_NAME','x')
                if (preg_match('/[\$\'"]' . $n . '[\'"]?\s*(?:=>|=|,)\s*[\'"]([^\'"]*)[\'"]/i', $src, $mm)) return $mm[1];
            }
            return null;
        };
        $v = $grab(['db_name', 'dbname', 'database', 'db', 'base', 'nom_base', 'DB_NAME', 'DB_DATABASE']);
        if ($v !== null && $v !== '') $eb_cred['name'] = $v;
        $v = $grab(['host', 'hostname', 'server', 'servername', 'serveur', 'DB_HOST', 'DB_SERVER']);
        if ($v) $eb_cred['host'] = $v;
        $v = $grab(['username', 'user', 'db_user', 'utilisateur', 'login', 'DB_USER', 'DB_USERNAME']);
        if ($v) $eb_cred['user'] = $v;
        $v = $grab(['password', 'pass', 'passwd', 'pwd', 'db_pass', 'mot_de_passe', 'motdepasse', 'DB_PASS', 'DB_PASSWORD']);
        if ($v !== null) $eb_cred['pass'] = $v;
        if (preg_match('/dbname=([A-Za-z0-9_\-]+)/', $src, $mm)) $eb_cred['name'] = $mm[1];
        if (preg_match('/host=([A-Za-z0-9_.\-]+)/', $src, $mm)) $eb_cred['host'] = $mm[1];
    }
    if ($eb_cred['name']) $eb_db = eb_try_pdo($eb_cred['host'], $eb_cred['name'], $eb_cred['user'], $eb_cred['pass']);
}

// e) Dernier recours : connexion WAMP par defaut, et on cherche la base qui contient les produits.
$eb_dbs_seen = [];
if (!$eb_db) {
    $server = eb_try_pdo($eb_cred['host'], null, $eb_cred['user'], $eb_cred['pass'])
        ?: eb_try_pdo('localhost', null, 'root', '')
        ?: eb_try_pdo('127.0.0.1', null, 'root', '');
    if ($server) {
        $best = null;
        $bestScore = -1;
        foreach ($server->query('SHOW DATABASES')->fetchAll(PDO::FETCH_COLUMN) as $dbn) {
            if (in_array(strtolower($dbn), ['information_schema', 'mysql', 'performance_schema', 'sys', 'phpmyadmin'], true)) continue;
            $eb_dbs_seen[] = $dbn;
            $tabs = array_map('strtolower', $server->query('SHOW TABLES FROM `' . str_replace('`', '', $dbn) . '`')->fetchAll(PDO::FETCH_COLUMN));
            $score = 0;
            foreach (['products', 'produits', 'produit', 'articles'] as $t) if (in_array($t, $tabs, true)) $score += 10;
            foreach (['sales', 'ventes', 'categories', 'users'] as $t) if (in_array($t, $tabs, true)) $score += 1;
            if (preg_match('/alim|tounkara|gestion|caisse|stock/i', $dbn)) $score += 5;
            if ($score >= 10 && $score > $bestScore) { $best = $dbn; $bestScore = $score; }
        }
        if ($best) {
            $server->exec('USE `' . str_replace('`', '', $best) . '`');
            $eb_db = $server;
        }
    }
}

if (!$eb_db) {
    eb_stop(
        "Connexion a la base introuvable",
        "Fichiers de configuration trouves : <b>" . htmlspecialchars(implode(', ', $eb_found_files) ?: 'aucun') . "</b><br>" .
        "Classes : <b>" . htmlspecialchars(implode(', ', array_slice($eb_classes, 0, 15)) ?: 'aucune') . "</b><br>" .
        "Base cherchee : <b>" . htmlspecialchars((string) ($eb_cred['name'] ?? '?')) . "</b> sur <b>" . htmlspecialchars((string) $eb_cred['host']) . "</b>" .
        ($eb_dbs_seen ? "<br>Bases visibles : <b>" . htmlspecialchars(implode(', ', $eb_dbs_seen)) . "</b>" : "")
    );
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

// Codes-barres ranges dans une table a part (table `barcodes` : un produit peut en avoir plusieurs).
$eb_codes = [];
$eb_btable = eb_find($eb_tables, ['barcodes', 'codes_barres', 'code_barres']);
if ($eb_btable) {
    try {
        foreach (eb_rows($eb_db, "SELECT * FROM `$eb_btable` ORDER BY id") as $b) {
            $pid = (string) ($b['product_id'] ?? $b['produit_id'] ?? '');
            $code = trim((string) ($b['barcode'] ?? $b['code'] ?? ''));
            if ($pid === '' || $code === '') continue;
            $type = strtoupper((string) ($b['barcode_type'] ?? 'UNIT'));
            // On garde le 1er code « a l'unite » (sinon le 1er trouve).
            if (!isset($eb_codes[$pid]) || ($eb_codes[$pid][1] !== 'UNIT' && $type === 'UNIT')) $eb_codes[$pid] = [$code, $type];
        }
    } catch (Throwable $e) {
        $eb_codes = [];
    }
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
    $pid = (string) ($row['id'] ?? $row['id_produit'] ?? $row['product_id'] ?? '');
    if ($pid !== '') {
        $p['ref'] = 'id-' . $pid; // numero du produit dans la caisse : ne change jamais
        if (empty($p['barcode']) && isset($eb_codes[$pid])) $p['barcode'] = $eb_codes[$pid][0];
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
