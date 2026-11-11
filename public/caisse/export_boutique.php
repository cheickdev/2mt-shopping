<?php
// Export des produits pour la boutique en ligne 2MT - Shopping.
// Ouvrir cette page (connecte a la caisse) telecharge un fichier
// « produits-caisse-AAAA-MM-JJ.json » a envoyer dans l'admin du site :
// Produits > « Importer depuis la caisse ».
require_once 'config/database.php';
requireLogin();

if (!canAccessManagement()) {
    http_response_code(403);
    echo "Acces reserve aux gerants et administrateurs.";
    exit();
}

$stmt = $pdo->query(
    "SELECT p.id, p.barcode, p.name, p.description, p.purchase_price, p.selling_price,
            p.stock_quantity, p.unit, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.is_active = 1
     ORDER BY p.name ASC"
);

$products = [];
foreach ($stmt as $row) {
    $products[] = [
        'id' => (int) $row['id'],
        'barcode' => (string) ($row['barcode'] ?? ''),
        'name' => html_entity_decode((string) $row['name'], ENT_QUOTES, 'UTF-8'),
        'description' => html_entity_decode((string) ($row['description'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'category' => html_entity_decode((string) ($row['category_name'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'price' => (int) round((float) $row['selling_price']),
        'cost' => (int) round((float) $row['purchase_price']),
        'stock' => (int) $row['stock_quantity'],
        'unit' => (string) ($row['unit'] ?? ''),
    ];
}

$file = 'produits-caisse-' . date('Y-m-d') . '.json';
header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $file . '"');
echo json_encode(
    [
        'source' => 'alimentation-tounkara',
        'exportedAt' => date('c'),
        'products' => $products,
    ],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
);
