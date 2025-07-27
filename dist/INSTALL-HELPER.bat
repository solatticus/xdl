@echo off
title XDL Extension Installer Helper
color 0B

echo ============================================
echo    XDL Browser Extension Installer v1.0.0
echo ============================================
echo.
echo This helper will guide you through the installation.
echo.

:EXTRACT
echo Step 1: Extract the ZIP file
echo.
echo Please extract xdl-extension-v1.0.0.zip to a permanent location.
echo Recommended: C:\Tools\xdl-extension\
echo.
echo Press any key once you've extracted the files...
pause >nul

:BROWSER
echo.
echo Step 2: Choose your browser
echo.
echo 1. Google Chrome
echo 2. Microsoft Edge
echo 3. Brave Browser
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo Opening Chrome extensions page...
    start chrome chrome://extensions/
    goto :INSTRUCTIONS
)
if "%choice%"=="2" (
    echo.
    echo Opening Edge extensions page...
    start msedge edge://extensions/
    goto :INSTRUCTIONS
)
if "%choice%"=="3" (
    echo.
    echo Opening Brave extensions page...
    start brave brave://extensions/
    goto :INSTRUCTIONS
)

echo Invalid choice. Please try again.
goto :BROWSER

:INSTRUCTIONS
echo.
echo Step 3: Install the extension
echo.
echo 1. Enable "Developer mode" using the toggle in the top right
echo 2. Click "Load unpacked"
echo 3. Navigate to where you extracted the files
echo 4. Select the "xdl-extension-v1.0.0" folder
echo 5. Click "Select Folder"
echo.
echo The XDL icon should now appear in your toolbar!
echo.
echo Press any key to open the help page...
pause >nul

start https://github.com/solatticus/xdl#browser-extension

echo.
echo Installation complete! Enjoy XDL!
echo.
pause
