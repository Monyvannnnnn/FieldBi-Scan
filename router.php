<?php
/**
 * router.php - Router script for PHP Built-in Web Server
 * Usage: php -S localhost:8000 router.php
 * Routes Angular / Ionic client routes to index.php while serving static assets directly.
 */

$path = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Normalize potential client route prefixes on static assets
if (preg_match('#^/home/(dist|assets|js|uploads)/#', $path)) {
    $path = preg_replace('#^/home/#', '/', $path);
}

$file = __DIR__ . $path;

// Serve static assets directly if they exist
if ($path !== '/' && file_exists($file) && !is_dir($file)) {
    // Correct MIME type for JS modules (critical for Angular / Ionic)
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    if ($ext === 'js') {
        header('Content-Type: application/javascript; charset=utf-8');
        readfile($file);
        return true;
    }
    if ($ext === 'css') {
        header('Content-Type: text/css; charset=utf-8');
        readfile($file);
        return true;
    }
    if ($ext === 'svg') {
        header('Content-Type: image/svg+xml');
        readfile($file);
        return true;
    }
    if ($ext === 'json') {
        header('Content-Type: application/json; charset=utf-8');
        readfile($file);
        return true;
    }
    return false; // Let PHP CLI built-in server handle other files
}

// Allow direct execution of API php files
if (strpos($path, '/api/') === 0 && file_exists($file)) {
    require_once $file;
    return true;
}

// All other Angular/Ionic routes go to index.php
require_once __DIR__ . '/index.php';
