<?php

/**
 * router.php - Standalone router for PHP Built-in Server
 * Usage: php -S localhost:8000 router.php
 */

$path = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$file = __DIR__ . $path;

// Serve uploaded files directly
if (strpos($path, '/uploads/') === 0 && file_exists($file) && !is_dir($file)) {
    $mime = mime_content_type($file);
    if ($mime) {
        header('Content-Type: ' . $mime);
    }
    readfile($file);
    return true;
}

// Allow direct execution of API php files
if (strpos($path, '/api/') === 0 && file_exists($file)) {
    require_once $file;
    return true;
}

// Route root or unknown paths to index.php
require_once __DIR__ . '/index.php';
