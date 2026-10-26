<?php

/**
 * db.php - Database Connector (Strict PHP 5.5.38 Compatibility)
 * Uses PDO with SQLite (zero configuration required).
 */

error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);

class Database
{
    private static $instance = null;
    private $pdo;

    private function __construct()
    {
        $dataDir = dirname(dirname(__FILE__)) . '/data';
        if (!file_exists($dataDir)) {
            mkdir($dataDir, 0777, true);
        }

        $dbPath = $dataDir . '/scanner.db';

        try {
            $this->pdo = new PDO('sqlite:' . $dbPath);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

            $this->initTables();
        } catch (PDOException $e) {
            header('Content-Type: application/json');
            echo json_encode(array(
                'status' => 'error',
                'message' => 'Database connection failed: ' . $e->getMessage()
            ));
            exit;
        }
    }

    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection()
    {
        return $this->pdo;
    }

    private function initTables()
    {
        // Invoices table
        $this->pdo->exec("CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT,
            po_number TEXT,
            document_type TEXT DEFAULT 'invoice',
            invoice_date TEXT,
            due_date TEXT,
            payment_terms TEXT,
            payment_method TEXT,
            vendor_name TEXT,
            vendor_tax_id TEXT,
            vendor_address TEXT,
            billed_to TEXT,
            buyer_tax_id TEXT,
            subtotal REAL DEFAULT 0,
            discount_amount REAL DEFAULT 0,
            shipping_amount REAL DEFAULT 0,
            tax_rate REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            grand_total REAL DEFAULT 0,
            currency TEXT DEFAULT 'USD',
            raw_ocr_text TEXT,
            invoice_json TEXT,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        // Invoice Line items table
        $this->pdo->exec("CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER,
            item_no INTEGER,
            sku TEXT,
            description TEXT,
            quantity REAL DEFAULT 1,
            uom TEXT DEFAULT 'pcs',
            unit_price REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            tax_rate REAL DEFAULT 0,
            total REAL DEFAULT 0,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        )");

        // Scanned Documents Session History
        $this->pdo->exec("CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT,
            file_name TEXT,
            pages_count INTEGER DEFAULT 1,
            thumbnail TEXT,
            updated_at INTEGER
        )");

        // Safe migrations for existing SQLite databases
        $columnsToEnsure = array(
            'invoices' => array(
                'po_number TEXT',
                'document_type TEXT DEFAULT "invoice"',
                'payment_terms TEXT',
                'payment_method TEXT',
                'vendor_tax_id TEXT',
                'buyer_tax_id TEXT',
                'discount_amount REAL DEFAULT 0',
                'shipping_amount REAL DEFAULT 0'
            ),
            'invoice_items' => array(
                'sku TEXT',
                'uom TEXT DEFAULT "pcs"',
                'discount REAL DEFAULT 0',
                'tax_rate REAL DEFAULT 0'
            )
        );

        foreach ($columnsToEnsure as $tbl => $cols) {
            foreach ($cols as $colDef) {
                try {
                    $this->pdo->exec("ALTER TABLE {$tbl} ADD COLUMN {$colDef}");
                } catch (Exception $e) {
                    // Column already exists, safe to ignore
                }
            }
        }
    }
}
