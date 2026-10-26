# FieldBi Invoice & Scanner Backend API

A pure PHP backend service with **zero frontend, zero HTML, and zero CSS/styles**.

This service handles invoice data persistence, uploaded document management, and AI Vision invoice extraction via Google Gemini.

---

## Folder Structure

```
backend/
├── .env                  # Environment variables (GEMINI_API_KEY)
├── .env.example          # Sample environment config
├── .gitignore            # Git ignore rules for DB, env, uploads
├── .htaccess             # Apache CORS, security, and rewrite settings
├── index.php             # JSON API root status & documentation endpoint
├── router.php            # Router script for PHP built-in server
├── start-server.bat      # One-click Windows starter script
├── README.md             # Backend API documentation
├── api/
│   ├── config.php        # Serves configuration / Gemini credentials
│   ├── db.php            # PDO SQLite database connection & schema
│   ├── extract.php       # Server-side Gemini AI Vision OCR extraction
│   ├── invoices.php      # Full CRUD for invoices and line items
│   ├── recent.php        # Recent scanned document sessions
│   └── upload.php        # Image & document upload handler
├── data/
│   └── scanner.db        # SQLite database file
└── uploads/              # Storage directory for uploaded images
```

---

## Quick Start

### Option 1: Using XAMPP Apache
Place or access this folder in Apache's document root (e.g. `http://localhost/web-php/backend/`).

### Option 2: Using Built-in PHP Server
Double-click `start-server.bat` or run:
```bash
php -S localhost:8000 router.php
```
The API will be available at `http://localhost:8000`.

---

## API Endpoints

### 1. API Status & Service Info
- **URL**: `GET /` or `GET /index.php`
- **Response**: JSON status, version, and endpoints overview.

---

### 2. Upload Document / Image
- **URL**: `POST /api/upload.php`
- **Method**: `POST`
- **Request Format**:
  - **Multipart form-data**: `file: [binary image]`
  - OR **JSON**:
    ```json
    {
      "dataUrl": "data:image/jpeg;base64,...",
      "fileName": "invoice_receipt.jpg"
    }
    ```
- **Response**:
  ```json
  {
    "status": "success",
    "file_name": "scan_1729930000_1234.jpg",
    "url": "uploads/scan_1729930000_1234.jpg"
  }
  ```

---

### 3. AI Vision Invoice OCR Extraction
- **URL**: `POST /api/extract.php`
- **Method**: `POST`
- **Description**: Uses Google Gemini AI Vision on the server to extract structured invoice data from an image.
- **Request Format**:
  ```json
  {
    "imageUrl": "uploads/scan_1729930000_1234.jpg"
  }
  ```
  *(Also accepts `dataUrl`, `base64`, or multipart `file`)*
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "documentType": "tax_invoice",
      "invoiceNumber": "INV-2026-001",
      "poNumber": "PO-9988",
      "invoiceDate": "2026-10-26",
      "dueDate": "2026-11-26",
      "paymentTerms": "Net 30",
      "paymentMethod": "Bank Transfer",
      "currency": "USD",
      "vendor": {
        "name": "Acme Supplies Co.",
        "taxId": "VAT-12345678",
        "street": "123 Business Rd",
        "city": "Phnom Penh",
        "country": "Cambodia",
        "phone": "+855 23 123 456",
        "email": "billing@acme.com"
      },
      "billTo": {
        "name": "FieldBi Tech",
        "taxId": "TIN-98765432",
        "street": "456 Enterprise Ave"
      },
      "items": [
        {
          "itemNo": 1,
          "sku": "PROD-CLOUD-01",
          "description": "Cloud Enterprise Subscription",
          "quantity": 1,
          "uom": "month",
          "unitPrice": 100.00,
          "discount": 10.00,
          "taxRate": 10.0,
          "total": 90.00
        }
      ],
      "subtotal": 100.00,
      "discountAmount": 10.00,
      "shippingAmount": 5.00,
      "taxRate": 10.0,
      "taxAmount": 9.00,
      "rounding": 0.00,
      "grandTotal": 104.00,
      "validation": {
        "mathValid": true,
        "computedItemsSum": 90.00,
        "computedGrandTotal": 104.00,
        "discrepancies": []
      }
    }
  }
  ```

---

### 4. Invoices Management
- **List Invoices**:
  - `GET /api/invoices.php`
  - `GET /api/invoices.php?limit=20`
- **Get Single Invoice**:
  - `GET /api/invoices.php?id=1`
- **Create Invoice**:
  - `POST /api/invoices.php`
  - Payload: Full invoice object with vendor, items, and totals.
- **Delete Invoice**:
  - `DELETE /api/invoices.php?id=1`

---

### 5. Document Sessions & History
- **List Sessions**: `GET /api/recent.php`
- **Save Session**: `POST /api/recent.php`
- **Delete Session**: `DELETE /api/recent.php?id={id}`

---

### 6. Client Configuration
- **URL**: `GET /api/config.php`
- **Description**: Retrieves loaded environment configuration (e.g. `geminiApiKey`).
