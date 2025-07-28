@echo off
:: XDL Extension Updater

echo.
echo ===================================
echo   XDL Extension Updater
echo ===================================
echo.

:: Use PowerShell to open the extensions page
echo Opening browser extensions page...

:: Try Chrome first
powershell -Command "if (Get-Process chrome -ErrorAction SilentlyContinue) { Start-Process 'chrome://extensions/'; exit 0 } else { exit 1 }" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Opened in Chrome.
    goto :instructions
)

:: Try Edge
powershell -Command "if (Get-Process msedge -ErrorAction SilentlyContinue) { Start-Process 'edge://extensions/'; exit 0 } else { exit 1 }" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Opened in Edge.
    goto :instructions
)

:: If no browser is running, start Chrome or Edge
powershell -Command "if (Test-Path '${env:ProgramFiles}\Google\Chrome\Application\chrome.exe') { Start-Process '${env:ProgramFiles}\Google\Chrome\Application\chrome.exe' -ArgumentList 'chrome://extensions/'; exit 0 } elseif (Test-Path '${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe') { Start-Process '${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe' -ArgumentList 'chrome://extensions/'; exit 0 } else { exit 1 }" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Started Chrome with extensions page.
    goto :instructions
)

powershell -Command "if (Test-Path '${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe') { Start-Process '${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe' -ArgumentList 'edge://extensions/'; exit 0 } else { exit 1 }" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Started Edge with extensions page.
    goto :instructions
)

:: Fallback - just try to open with default browser
echo Trying default browser...
start chrome://extensions/ >nul 2>&1
start edge://extensions/ >nul 2>&1

:instructions
echo.
echo ===================================
echo TO UPDATE THE EXTENSION:
echo.
echo 1. Find "XDL - Video Downloader"
echo 2. Click the Reload button (circular arrow)
echo.
echo That's it! Extension updated.
echo ===================================
echo.
pause