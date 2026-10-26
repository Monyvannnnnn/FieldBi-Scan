<?php

/**
 * index.php - Pure Backend REST API Entry Point
 * Zero frontend, zero HTML, zero CSS/styles.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost');
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
$apiBase = $baseUrl . ($scriptDir === '' ? '' : $scriptDir) . '/api/';

$response = array(
    'service' => 'FieldBi Invoice & Document OCR Backend API',
    'status'  => 'healthy',
    'version' => '1.0.0',
    'php'     => PHP_VERSION,
    'documentation' => array(
        'description' => 'Pure backend REST API service for invoice management, image storage, and Gemini Vision OCR extraction.',
        'endpoints' => array(
            array(
                'method' => 'GET',
                'endpoint' => $apiBase . 'config.php',
                'description' => 'Retrieve API configuration parameters and loaded Gemini credentials'
            ),
            array(
                'method' => 'POST',
                'endpoint' => $apiBase . 'upload.php',
                'description' => 'Upload document/invoice image via multipart file or base64 JSON payload'
            ),
            array(
                'method' => 'POST',
                'endpoint' => $apiBase . 'extract.php',
                'description' => 'Extract structured invoice JSON from an image using Gemini AI Vision'
            ),
            array(
                'method' => 'GET',
                'endpoint' => $apiBase . 'invoices.php',
                'description' => 'List saved invoices (supports ?id={id} for full details and ?limit={n})'
            ),
            array(
                'method' => 'POST',
                'endpoint' => $apiBase . 'invoices.php',
                'description' => 'Create and persist an invoice with vendor details, line items, and totals'
            ),
            array(
                'method' => 'DELETE',
                'endpoint' => $apiBase . 'invoices.php?id={id}',
                'description' => 'Delete an invoice by ID'
            ),
            array(
                'method' => 'GET',
                'endpoint' => $apiBase . 'recent.php',
                'description' => 'Get recent scanning sessions and history'
            ),
            array(
                'method' => 'POST',
                'endpoint' => $apiBase . 'recent.php',
                'description' => 'Save/update recent scan session record'
            ),
            array(
                'method' => 'DELETE',
                'endpoint' => $apiBase . 'recent.php?id={id}',
                'description' => 'Delete a scan session record by ID'
            )
        )
    )
);

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
