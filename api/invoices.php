<?php
/**
 * invoices.php - AP Invoice API Endpoint (PHP 5.5.38 compatible)
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once dirname(__FILE__) . '/db.php';
$pdo = Database::getInstance()->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query("SELECT * FROM invoices ORDER BY id DESC LIMIT 50");
    $invoices = $stmt->fetchAll();

    echo json_encode(array(
        'status' => 'success',
        'data' => $invoices
    ));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload) {
        echo json_encode(array('status' => 'error', 'message' => 'Invalid JSON payload'));
        exit;
    }

    try {
        $pdo->beginTransaction();

        $vendor = isset($payload['vendor']) ? $payload['vendor'] : array();
        $billTo = isset($payload['billTo']) ? $payload['billTo'] : array();

        $vendorName = isset($vendor['name']) ? $vendor['name'] : (isset($payload['vendorName']) ? $payload['vendorName'] : '');
        $vendorAddress = isset($vendor['street']) ? $vendor['street'] : (isset($payload['vendorAddress']) ? $payload['vendorAddress'] : '');
        $billedTo = isset($billTo['name']) ? $billTo['name'] : (isset($payload['billedTo']) ? $payload['billedTo'] : '');

        $sql = "INSERT INTO invoices (
            invoice_number, invoice_date, due_date, vendor_name, vendor_address, 
            billed_to, subtotal, tax_rate, tax_amount, grand_total, 
            currency, raw_ocr_text, invoice_json, image_url
        ) VALUES (
            :invoice_number, :invoice_date, :due_date, :vendor_name, :vendor_address,
            :billed_to, :subtotal, :tax_rate, :tax_amount, :grand_total,
            :currency, :raw_ocr_text, :invoice_json, :image_url
        )";

        $stmt = $pdo->prepare($sql);
        $stmt->execute(array(
            ':invoice_number' => isset($payload['invoiceNumber']) ? $payload['invoiceNumber'] : '',
            ':invoice_date'   => isset($payload['invoiceDate']) ? $payload['invoiceDate'] : date('Y-m-d'),
            ':due_date'       => isset($payload['dueDate']) ? $payload['dueDate'] : date('Y-m-d'),
            ':vendor_name'    => $vendorName,
            ':vendor_address' => $vendorAddress,
            ':billed_to'      => $billedTo,
            ':subtotal'       => isset($payload['subtotal']) ? floatval($payload['subtotal']) : 0,
            ':tax_rate'       => isset($payload['taxRate']) ? floatval($payload['taxRate']) : 0,
            ':tax_amount'     => isset($payload['taxAmount']) ? floatval($payload['taxAmount']) : 0,
            ':grand_total'    => isset($payload['grandTotal']) ? floatval($payload['grandTotal']) : 0,
            ':currency'       => isset($payload['currency']) ? $payload['currency'] : 'USD',
            ':raw_ocr_text'   => isset($payload['rawOcrText']) ? $payload['rawOcrText'] : '',
            ':invoice_json'   => json_encode($payload),
            ':image_url'      => isset($payload['imageUrl']) ? $payload['imageUrl'] : ''
        ));

        $invoiceId = $pdo->lastInsertId();

        // Insert Line items
        if (isset($payload['items']) && is_array($payload['items'])) {
            $itemSql = "INSERT INTO invoice_items (invoice_id, item_no, description, quantity, unit_price, total) 
                        VALUES (:invoice_id, :item_no, :description, :quantity, :unit_price, :total)";
            $itemStmt = $pdo->prepare($itemSql);

            foreach ($payload['items'] as $idx => $item) {
                $itemStmt->execute(array(
                    ':invoice_id'   => $invoiceId,
                    ':item_no'      => isset($item['itemNo']) ? intval($item['itemNo']) : ($idx + 1),
                    ':description'  => isset($item['description']) ? $item['description'] : '',
                    ':quantity'     => isset($item['quantity']) ? floatval($item['quantity']) : 1,
                    ':unit_price'   => isset($item['unitPrice']) ? floatval($item['unitPrice']) : 0,
                    ':total'        => isset($item['total']) ? floatval($item['total']) : 0
                ));
            }
        }

        $pdo->commit();

        echo json_encode(array(
            'status' => 'success',
            'invoice_id' => $invoiceId,
            'message' => 'Invoice saved successfully to PHP backend'
        ));
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(array(
            'status' => 'error',
            'message' => 'Failed to save invoice: ' . $e->getMessage()
        ));
    }
}
