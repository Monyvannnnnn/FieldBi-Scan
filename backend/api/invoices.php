<?php

/**
 * invoices.php - AP Invoice API Endpoint (PHP 5.5.38 compatible)
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once dirname(__FILE__) . '/db.php';
$pdo = Database::getInstance()->getConnection();

// GET invoices
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['id']) && !empty($_GET['id'])) {
        $invoiceId = intval($_GET['id']);
        $stmt = $pdo->prepare("SELECT * FROM invoices WHERE id = :id LIMIT 1");
        $stmt->execute(array(':id' => $invoiceId));
        $invoice = $stmt->fetch();

        if ($invoice) {
            $itemStmt = $pdo->prepare("SELECT * FROM invoice_items WHERE invoice_id = :id ORDER BY item_no ASC");
            $itemStmt->execute(array(':id' => $invoiceId));
            $invoice['items'] = $itemStmt->fetchAll();

            echo json_encode(array(
                'status' => 'success',
                'data' => $invoice
            ));
        } else {
            http_response_code(404);
            echo json_encode(array(
                'status' => 'error',
                'message' => 'Invoice not found'
            ));
        }
        exit;
    }

    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
    if ($limit <= 0 || $limit > 200) $limit = 50;

    $stmt = $pdo->prepare("SELECT * FROM invoices ORDER BY id DESC LIMIT :limit");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $invoices = $stmt->fetchAll();

    echo json_encode(array(
        'status' => 'success',
        'count' => count($invoices),
        'data' => $invoices
    ));
    exit;
}

// POST create invoice
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
        $vendorTaxId = isset($vendor['taxId']) ? $vendor['taxId'] : (isset($payload['vendorTaxId']) ? $payload['vendorTaxId'] : '');

        $billedTo = isset($billTo['name']) ? $billTo['name'] : (isset($payload['billedTo']) ? $payload['billedTo'] : '');
        $buyerTaxId = isset($billTo['taxId']) ? $billTo['taxId'] : (isset($payload['buyerTaxId']) ? $payload['buyerTaxId'] : '');

        $poNumber = isset($payload['poNumber']) ? $payload['poNumber'] : (isset($payload['po_number']) ? $payload['po_number'] : '');
        $docType = isset($payload['documentType']) ? $payload['documentType'] : 'invoice';
        $paymentTerms = isset($payload['paymentTerms']) ? $payload['paymentTerms'] : '';
        $paymentMethod = isset($payload['paymentMethod']) ? $payload['paymentMethod'] : '';
        $discountAmount = isset($payload['discountAmount']) ? floatval($payload['discountAmount']) : (isset($payload['discount_amount']) ? floatval($payload['discount_amount']) : 0);
        $shippingAmount = isset($payload['shippingAmount']) ? floatval($payload['shippingAmount']) : (isset($payload['shipping_amount']) ? floatval($payload['shipping_amount']) : 0);

        $sql = "INSERT INTO invoices (
            invoice_number, po_number, document_type, invoice_date, due_date, 
            payment_terms, payment_method, vendor_name, vendor_tax_id, vendor_address, 
            billed_to, buyer_tax_id, subtotal, discount_amount, shipping_amount, 
            tax_rate, tax_amount, grand_total, currency, raw_ocr_text, invoice_json, image_url
        ) VALUES (
            :invoice_number, :po_number, :document_type, :invoice_date, :due_date,
            :payment_terms, :payment_method, :vendor_name, :vendor_tax_id, :vendor_address,
            :billed_to, :buyer_tax_id, :subtotal, :discount_amount, :shipping_amount,
            :tax_rate, :tax_amount, :grand_total, :currency, :raw_ocr_text, :invoice_json, :image_url
        )";

        $stmt = $pdo->prepare($sql);
        $stmt->execute(array(
            ':invoice_number'   => isset($payload['invoiceNumber']) ? $payload['invoiceNumber'] : '',
            ':po_number'        => $poNumber,
            ':document_type'    => $docType,
            ':invoice_date'     => isset($payload['invoiceDate']) ? $payload['invoiceDate'] : date('Y-m-d'),
            ':due_date'         => isset($payload['dueDate']) ? $payload['dueDate'] : date('Y-m-d'),
            ':payment_terms'    => $paymentTerms,
            ':payment_method'   => $paymentMethod,
            ':vendor_name'      => $vendorName,
            ':vendor_tax_id'    => $vendorTaxId,
            ':vendor_address'   => $vendorAddress,
            ':billed_to'        => $billedTo,
            ':buyer_tax_id'     => $buyerTaxId,
            ':subtotal'         => isset($payload['subtotal']) ? floatval($payload['subtotal']) : 0,
            ':discount_amount'  => $discountAmount,
            ':shipping_amount'  => $shippingAmount,
            ':tax_rate'         => isset($payload['taxRate']) ? floatval($payload['taxRate']) : 0,
            ':tax_amount'       => isset($payload['taxAmount']) ? floatval($payload['taxAmount']) : 0,
            ':grand_total'      => isset($payload['grandTotal']) ? floatval($payload['grandTotal']) : 0,
            ':currency'         => isset($payload['currency']) ? $payload['currency'] : 'USD',
            ':raw_ocr_text'     => isset($payload['rawOcrText']) ? $payload['rawOcrText'] : '',
            ':invoice_json'     => json_encode($payload),
            ':image_url'        => isset($payload['imageUrl']) ? $payload['imageUrl'] : ''
        ));

        $invoiceId = $pdo->lastInsertId();

        // Insert Line items
        if (isset($payload['items']) && is_array($payload['items'])) {
            $itemSql = "INSERT INTO invoice_items (invoice_id, item_no, sku, description, quantity, uom, unit_price, discount, tax_rate, total) 
                        VALUES (:invoice_id, :item_no, :sku, :description, :quantity, :uom, :unit_price, :discount, :tax_rate, :total)";
            $itemStmt = $pdo->prepare($itemSql);

            foreach ($payload['items'] as $idx => $item) {
                $itemStmt->execute(array(
                    ':invoice_id'   => $invoiceId,
                    ':item_no'      => isset($item['itemNo']) ? intval($item['itemNo']) : ($idx + 1),
                    ':sku'          => isset($item['sku']) ? $item['sku'] : '',
                    ':description'  => isset($item['description']) ? $item['description'] : '',
                    ':quantity'     => isset($item['quantity']) ? floatval($item['quantity']) : 1,
                    ':uom'          => isset($item['uom']) ? $item['uom'] : 'pcs',
                    ':unit_price'   => isset($item['unitPrice']) ? floatval($item['unitPrice']) : 0,
                    ':discount'     => isset($item['discount']) ? floatval($item['discount']) : 0,
                    ':tax_rate'     => isset($item['taxRate']) ? floatval($item['taxRate']) : 0,
                    ':total'        => isset($item['total']) ? floatval($item['total']) : 0
                ));
            }
        }

        $pdo->commit();

        echo json_encode(array(
            'status' => 'success',
            'invoice_id' => $invoiceId,
            'message' => 'Invoice saved successfully'
        ));
        exit;
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(array(
            'status' => 'error',
            'message' => 'Failed to save invoice: ' . $e->getMessage()
        ));
        exit;
    }
}

// DELETE invoice
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($id > 0) {
        $stmt = $pdo->prepare("DELETE FROM invoices WHERE id = :id");
        $stmt->execute(array(':id' => $id));

        $itemStmt = $pdo->prepare("DELETE FROM invoice_items WHERE invoice_id = :id");
        $itemStmt->execute(array(':id' => $id));

        echo json_encode(array('status' => 'success', 'message' => 'Invoice deleted'));
        exit;
    }
    echo json_encode(array('status' => 'error', 'message' => 'Missing valid invoice id'));
    exit;
}
