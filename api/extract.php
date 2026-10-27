<?php

/**
 * extract.php - Server-Side Gemini AI Vision Invoice OCR Extraction
 * Takes an image or PDF and extracts structured invoice data using Gemini Vision API.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// 1. Load GEMINI_API_KEY from .env
$envFile = dirname(dirname(__FILE__)) . '/.env';
$geminiApiKey = '';

if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($k, $v) = explode('=', $line, 2);
            if (trim($k) === 'GEMINI_API_KEY') {
                $geminiApiKey = trim($v, " \t\n\r\0\x0B\"'");
            }
        }
    }
}

if (empty($geminiApiKey)) {
    http_response_code(500);
    echo json_encode(array(
        'status' => 'error',
        'message' => 'GEMINI_API_KEY is not configured in .env'
    ));
    exit;
}

// 2. Obtain base64 data and mime type
$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

$base64Data = '';
$mimeType = 'image/jpeg';

// Check multipart file upload
if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    $tmpPath = $_FILES['file']['tmp_name'];
    $mimeType = mime_content_type($tmpPath) ?: 'image/jpeg';
    $base64Data = base64_encode(file_get_contents($tmpPath));
}
// Check JSON dataUrl
elseif ($payload && isset($payload['dataUrl'])) {
    $dataUrl = $payload['dataUrl'];
    if (preg_match('/^data:([^;]+);base64,(.+)$/', $dataUrl, $matches)) {
        $mimeType = $matches[1];
        $base64Data = $matches[2];
    }
}
// Check JSON base64 string
elseif ($payload && isset($payload['base64'])) {
    $base64Data = $payload['base64'];
    if (isset($payload['mimeType'])) {
        $mimeType = $payload['mimeType'];
    }
}
// Check local image URL / path
elseif ($payload && isset($payload['imageUrl'])) {
    $relPath = ltrim($payload['imageUrl'], '/\\');
    $fullPath = dirname(dirname(__FILE__)) . '/' . $relPath;
    if (file_exists($fullPath)) {
        $mimeType = mime_content_type($fullPath) ?: 'image/jpeg';
        $base64Data = base64_encode(file_get_contents($fullPath));
    }
}

if (empty($base64Data)) {
    http_response_code(400);
    echo json_encode(array(
        'status' => 'error',
        'message' => 'Please provide an image or PDF via file, dataUrl, base64, or imageUrl'
    ));
    exit;
}

// 3. Prompt for Structured Invoice Extraction
$promptText = "Extract invoice, receipt, or bill information from this document image/PDF into a strictly valid JSON object.\n" .
    "JSON structure required:\n" .
    "{\n" .
    "  \"documentType\": \"AP_INVOICE\",\n" .
    "  \"invoiceNumber\": \"string or null\",\n" .
    "  \"poNumber\": \"string or null (Purchase Order / Reference / Order number)\",\n" .
    "  \"invoiceDate\": \"YYYY-MM-DD or null\",\n" .
    "  \"dueDate\": \"YYYY-MM-DD or null\",\n" .
    "  \"paymentTerms\": \"string or null (e.g. Net 30, Due upon receipt, COD)\",\n" .
    "  \"paymentMethod\": \"string or null (e.g. Bank Transfer, Credit Card, Cash, ABA/Bakong QR)\",\n" .
    "  \"bankDetails\": {\n" .
    "    \"bankName\": \"string or null\",\n" .
    "    \"accountName\": \"string or null\",\n" .
    "    \"accountNumber\": \"string or null\",\n" .
    "    \"iban\": \"string or null\",\n" .
    "    \"swiftBic\": \"string or null\"\n" .
    "  },\n" .
    "  \"currency\": \"USD | KHR | EUR | etc.\",\n" .
    "  \"exchangeRate\": null,\n" .
    "  \"secondaryCurrency\": null,\n" .
    "  \"secondaryTotal\": null,\n" .
    "  \"vendor\": {\n" .
    "    \"name\": \"string or null\",\n" .
    "    \"taxId\": \"string or null (VAT / TIN / Business Reg No)\",\n" .
    "    \"street\": \"string or null\",\n" .
    "    \"city\": \"string or null\",\n" .
    "    \"country\": \"string or null\",\n" .
    "    \"phone\": \"string or null\",\n" .
    "    \"email\": \"string or null\"\n" .
    "  },\n" .
    "  \"billTo\": {\n" .
    "    \"name\": \"string or null\",\n" .
    "    \"taxId\": \"string or null (Customer Tax ID / VAT)\",\n" .
    "    \"street\": \"string or null\",\n" .
    "    \"city\": \"string or null\",\n" .
    "    \"country\": \"string or null\",\n" .
    "    \"phone\": \"string or null\",\n" .
    "    \"email\": \"string or null\"\n" .
    "  },\n" .
    "  \"items\": [\n" .
    "    {\n" .
    "      \"itemNo\": 1,\n" .
    "      \"sku\": \"string or null (product code/barcode)\",\n" .
    "      \"description\": \"string\",\n" .
    "      \"quantity\": 1,\n" .
    "      \"uom\": \"pcs | hrs | kg | box | etc.\",\n" .
    "      \"unitPrice\": 0,\n" .
    "      \"discount\": 0,\n" .
    "      \"taxRate\": 0,\n" .
    "      \"total\": 0\n" .
    "    }\n" .
    "  ],\n" .
    "  \"subtotal\": 0,\n" .
    "  \"discountAmount\": 0,\n" .
    "  \"shippingAmount\": 0,\n" .
    "  \"taxRate\": 0,\n" .
    "  \"taxAmount\": 0,\n" .
    "  \"rounding\": 0,\n" .
    "  \"grandTotal\": 0,\n" .
    "  \"rawOcrText\": \"full transcribed text from the document\"\n" .
    "}\n" .
    "IMPORTANT RULES:\n" .
    "- Return ONLY the raw valid JSON object, without markdown code fences (no ```json).\n" .
    "- Numeric values must be numbers (float or int), not strings with currency symbols.\n" .
    "- If a field is not found in the document, use null or 0 as appropriate.";

$models = array('gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest');
$lastError = '';
$extractedData = null;

foreach ($models as $model) {
    $apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($geminiApiKey);

    $requestBody = array(
        'contents' => array(
            array(
                'parts' => array(
                    array(
                        'text' => $promptText
                    ),
                    array(
                        'inline_data' => array(
                            'mime_type' => $mimeType,
                            'data' => $base64Data
                        )
                    )
                )
            )
        ),
        'generationConfig' => array(
            'temperature' => 0.1,
            'responseMimeType' => 'application/json'
        )
    );

    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestBody));
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
    curl_setopt($ch, CURLOPT_TIMEOUT, 35);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $rawResponse = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($httpCode === 200 && $rawResponse) {
        $jsonResp = json_decode($rawResponse, true);
        if (isset($jsonResp['candidates'][0]['content']['parts'][0]['text'])) {
            $rawText = trim($jsonResp['candidates'][0]['content']['parts'][0]['text']);
            $rawText = preg_replace('/^```(?:json)?\s*/i', '', $rawText);
            $rawText = preg_replace('/\s*```$/', '', $rawText);

            $parsed = json_decode($rawText, true);
            if (is_array($parsed)) {
                $extractedData = $parsed;
                break;
            }
        }
    } else {
        $lastError = "HTTP {$httpCode}: " . ($rawResponse ?: $curlErr);
    }
}

if ($extractedData !== null) {
    echo json_encode(array(
        'status' => 'success',
        'data' => $extractedData
    ));
} else {
    http_response_code(502);
    echo json_encode(array(
        'status' => 'error',
        'message' => 'Gemini AI Vision extraction failed',
        'details' => $lastError
    ));
}

