<?php

/**
 * upload.php - Receives and saves scanned images & documents (PHP 5.5.38 compatible)
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

// Accept both JSON payload (base64) and multipart/form-data
$uploadDir = dirname(dirname(__FILE__)) . '/uploads/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    $ext = pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION);
    if (empty($ext)) $ext = 'jpg';
    $fileName = 'scan_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
    $targetPath = $uploadDir . $fileName;

    if (move_uploaded_file($_FILES['file']['tmp_name'], $targetPath)) {
        echo json_encode(array(
            'status' => 'success',
            'file_name' => $fileName,
            'url' => 'uploads/' . $fileName
        ));
        exit;
    }
}

if ($data && isset($data['dataUrl'])) {
    $dataUrl = $data['dataUrl'];
    if (preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $matches)) {
        $ext = strtolower($matches[1]);
        $base64Data = substr($dataUrl, strpos($dataUrl, ',') + 1);
        $decoded = base64_decode($base64Data);

        if ($decoded !== false) {
            $prefix = isset($data['fileName']) ? pathinfo($data['fileName'], PATHINFO_FILENAME) : 'scan';
            $prefix = preg_replace('/[^a-zA-Z0-9_-]/', '_', $prefix);
            $fileName = $prefix . '_' . time() . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
            $targetPath = $uploadDir . $fileName;

            file_put_contents($targetPath, $decoded);

            echo json_encode(array(
                'status' => 'success',
                'file_name' => $fileName,
                'url' => 'uploads/' . $fileName
            ));
            exit;
        }
    }
}

echo json_encode(array(
    'status' => 'error',
    'message' => 'No valid image data or file provided'
));
