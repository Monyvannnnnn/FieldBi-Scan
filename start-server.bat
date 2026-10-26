@echo off
title FieldBi Ionic Scanner - PHP Server
echo ========================================================
echo Starting FieldBi Document Scanner PHP Server (PHP 5.5.38)
echo ========================================================
echo.
echo Local URL: http://localhost:8000/
echo Press Ctrl+C to stop the server.
echo.

if exist "d:\xammp\xampp\php\php.exe" (
    "d:\xammp\xampp\php\php.exe" -S localhost:8000 router.php
) else if exist "d:\XAMPP 5.5.38\php\php.exe" (
    "d:\XAMPP 5.5.38\php\php.exe" -S localhost:8000 router.php
) else (
    php -S localhost:8000 router.php
)
pause
