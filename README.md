# FieldBi Document Scanner - PHP Web Studio (PHP 5.5.38+)

This directory contains the standalone **PHP Web Studio** edition of the FieldBi Document Scanner.

## Features & Architecture

* **Backend**: Strict **PHP 5.5.38** compatibility (uses standard array syntax, PDO SQLite / MySQL, zero external PHP Composer dependencies).
* **UI**: **Bootstrap 5.3** + Bootstrap Icons + Custom FieldBi Dark Studio Theme.
* **P2P Mobile Sync**: **PeerJS** + **QRCode.js** WebRTC engine (directly pairs with Android & iOS mobile phones).
* **Client-Side OCR**: **Tesseract.js v5** (Khmer `khm` and English `eng` OCR running in Web Workers).
* **PDF & Compression**: **PDF-Lib** (multi-page PDF matching exact aspect ratios) and **JSZip** (batch ZIP download).
* **Local Persistence**: **IndexedDB / LocalStorage** session restore + PHP SQLite database (`api/scanner.db`).

---

## Directory Structure

```text
web-php/
├── index.php             # Main Studio application page (Bootstrap 5.3 UI)
├── css/
│   └── studio.css        # Studio dark glassmorphism stylesheet
├── js/
│   ├── app.js            # Studio Controller (canvas, filters, indexedDB, state)
│   ├── p2p-scanner.js    # PeerJS WebRTC mobile pairing & data streaming
│   ├── ocr-invoice.js    # Tesseract.js (Khmer/Eng) & pattern invoice parser
│   └── pdf-export.js     # PDF-Lib & JSZip multi-page exporter
├── api/
│   ├── db.php            # PHP 5.5 PDO SQLite connector with auto-table schema
│   ├── upload.php        # Receives & saves base64 images to uploads/
│   ├── invoices.php      # AP Invoice CRUD & save endpoint
│   └── recent.php        # Session & history storage
└── uploads/              # Storage directory for scanned documents
```

---

## How to Run Locally with PHP

If you have PHP installed:
```bash
cd web-php
php -S localhost:8000
```
Then open `http://localhost:8000/` in your browser.

Or copy the `web-php/` folder into your Apache/Nginx web directory (e.g. `htdocs/` in XAMPP or `/var/www/html/`).
