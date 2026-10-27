@echo off
setlocal enabledelayedexpansion
title FieldBi Scanner - Local Dev Server

echo ========================================================
echo    Starting FieldBi Document Scanner PHP Server
echo ========================================================
echo.

:: 1. Locate PHP executable
set "PHP_EXE="

if exist "c:\for code\xampp\php\php.exe" (
    set "PHP_EXE=c:\for code\xampp\php\php.exe"
) else if exist "d:\xammp\xampp\php\php.exe" (
    set "PHP_EXE=d:\xammp\xampp\php\php.exe"
) else if exist "c:\xampp\php\php.exe" (
    set "PHP_EXE=c:\xampp\php\php.exe"
) else if exist "d:\xampp\php\php.exe" (
    set "PHP_EXE=d:\xampp\php\php.exe"
) else (
    where php >nul 2>nul
    if !errorlevel! equ 0 (
        set "PHP_EXE=php"
    )
)

if "%PHP_EXE%"=="" (
    echo [ERROR] PHP executable was not found!
    echo Please install PHP or install XAMPP.
    pause
    exit /b 1
)

:: 2. Choose Port (default 8000, fallback to 8080 if 8000 is busy)
set "PORT=8000"
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul 2>nul
if !errorlevel! equ 0 (
    echo Port 8000 is in use, switching to port 8080...
    set "PORT=8080"
)

echo [+] Using PHP: "%PHP_EXE%"
echo [+] Server URL: http://localhost:%PORT%/
echo [+] Starting browser in 1 second...
echo.
echo Press Ctrl+C to stop the server at any time.
echo ========================================================
echo.

:: 3. Launch browser automatically
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:%PORT%/"

:: 4. Start PHP Built-in Server with router.php
"%PHP_EXE%" -S localhost:%PORT% router.php

pause
