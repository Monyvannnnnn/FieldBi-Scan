@echo off
title FieldBi Backend API Server
echo ========================================================
echo Starting FieldBi Backend API Server (Pure Backend)
echo URL: http://localhost:8000
echo ========================================================
cd /d "%~dp0"
if exist "d:\xammp\xampp\php\php.exe" (
    "d:\xammp\xampp\php\php.exe" -S localhost:8000 router.php
) else (
    php -S localhost:8000 router.php
)
pause
