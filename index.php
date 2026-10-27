<?php

/**
 * index.php - FieldBi Document Scanner Web Studio
 * Backend: PHP 5.5.38 Compatible
 * Serves the full FieldBi CamScanner Studio with direct integration to api/ backend endpoints.
 */

// Initialize uploads directory if not present
$uploadDir = dirname(__FILE__) . '/uploads';
if (!file_exists($uploadDir)) {
  mkdir($uploadDir, 0777, true);
}

// Load environment variables from .env
$envFile = dirname(__FILE__) . '/.env';
$geminiApiKey = '';
if (file_exists($envFile)) {
  $envLines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  foreach ($envLines as $line) {
    $line = trim($line);
    if ($line === '' || strpos($line, '#') === 0) continue;
    if (strpos($line, '=') !== false) {
      list($k, $v) = explode('=', $line, 2);
      $k = trim($k);
      $v = trim($v, " \t\n\r\0\x0B\"'");
      if ($k === 'GEMINI_API_KEY') {
        $geminiApiKey = $v;
      }
    }
  }
}
?>
<!doctype html>
<html lang="en" data-beasties-container>

<head>
  <meta charset="utf-8">
  <title>FieldBi - Document Scanner</title>

  <!-- External CSS Stylesheets -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="css/fonts.css?v=<?php echo filemtime(dirname(__FILE__) . '/css/fonts.css'); ?>">
  <link rel="stylesheet" href="css/theme.css?v=<?php echo filemtime(dirname(__FILE__) . '/css/theme.css'); ?>">
  <link rel="stylesheet" href="dist/styles-USYXGXB7.css?v=<?php echo filemtime(dirname(__FILE__) . '/dist/styles-USYXGXB7.css'); ?>">
  <link rel="stylesheet" href="css/scanner.css?v=<?php echo filemtime(dirname(__FILE__) . '/css/scanner.css'); ?>">
  <link rel="stylesheet" href="css/invoice-form.css?v=<?php echo filemtime(dirname(__FILE__) . '/css/invoice-form.css'); ?>">
</head>

<body>
  <script>
    window.PHP_BACKEND = {
      version: "5.5.38",
      apiBase: "./api/",
      endpoints: {
        upload: "./api/upload.php",
        extract: "./api/extract.php",
        invoices: "./api/invoices.php",
        recent: "./api/recent.php"
      },
      // Gemini API Key loaded from .env file (or localStorage fallback)
      geminiApiKey: <?php echo json_encode($geminiApiKey); ?> || localStorage.getItem("GEMINI_API_KEY") || ""
    };
    if (window.PHP_BACKEND && window.PHP_BACKEND.geminiApiKey) {
      window.GEMINI_API_KEY = window.PHP_BACKEND.geminiApiKey;
    }
  </script>
  <app-root></app-root>
  <link rel="modulepreload" href="dist/chunk-C86zhvaO.js">
  <link rel="modulepreload" href="dist/chunk-D9AI81tR.js">
  <link rel="modulepreload" href="dist/chunk-CfZDj8X5.js">
  <link rel="modulepreload" href="dist/chunk-BDsr83Wc.js">
  <link rel="modulepreload" href="dist/chunk-CABSGZFi.js">
  <script src="js/pdf.min.js?v=<?php echo filemtime(dirname(__FILE__) . '/js/pdf.min.js'); ?>"></script>
  <script>
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/pdf.worker.min.js";
    }
  </script>
  <script src="js/ocr-invoice.js"></script>
  <script src="dist/main-WK3YL7MT.js?v=<?php echo filemtime(dirname(__FILE__) . '/dist/chunk-gROQH1QD.js'); ?>" type="module"></script>
  <script src="js/standard-invoice-form.js?v=<?php echo filemtime(dirname(__FILE__) . '/js/standard-invoice-form.js'); ?>" defer></script>
</body>

</html>