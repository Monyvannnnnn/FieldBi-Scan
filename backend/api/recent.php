<?php

/**
 * recent.php - Session & Recent Documents API (PHP 5.5.38 compatible)
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once dirname(__FILE__) . '/db.php';
$pdo = Database::getInstance()->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query("SELECT * FROM documents ORDER BY updated_at DESC LIMIT 30");
    $docs = $stmt->fetchAll();

    echo json_encode(array(
        'status' => 'success',
        'count' => count($docs),
        'data' => $docs
    ));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload || !isset($payload['id'])) {
        echo json_encode(array('status' => 'error', 'message' => 'Missing document ID'));
        exit;
    }

    $sql = "INSERT OR REPLACE INTO documents (id, title, file_name, pages_count, thumbnail, updated_at) 
            VALUES (:id, :title, :file_name, :pages_count, :thumbnail, :updated_at)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array(
        ':id'          => $payload['id'],
        ':title'       => isset($payload['title']) ? $payload['title'] : 'Untitled Document',
        ':file_name'   => isset($payload['fileName']) ? $payload['fileName'] : 'document.pdf',
        ':pages_count' => isset($payload['pagesCount']) ? intval($payload['pagesCount']) : 1,
        ':thumbnail'   => isset($payload['thumbnail']) ? $payload['thumbnail'] : '',
        ':updated_at'  => isset($payload['updatedAt']) ? intval($payload['updatedAt']) : time()
    ));

    echo json_encode(array('status' => 'success'));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $docId = isset($_GET['id']) ? $_GET['id'] : '';
    if ($docId) {
        $stmt = $pdo->prepare("DELETE FROM documents WHERE id = :id");
        $stmt->execute(array(':id' => $docId));
    }
    echo json_encode(array('status' => 'success'));
    exit;
}
