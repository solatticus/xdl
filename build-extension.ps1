# XDL Extension Build Script
# Creates a distributable package for the browser extension

param(
    [string]$Version = "1.0.0"
)

Write-Host "XDL Extension Builder v1.0" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# Paths
$rootPath = $PSScriptRoot
$extensionPath = Join-Path $rootPath "extension"
$distPath = Join-Path $rootPath "dist"
$releasePath = Join-Path $distPath "xdl-extension-v$Version"

# Clean previous builds
Write-Host "`nCleaning previous builds..." -ForegroundColor Yellow
if (Test-Path $distPath) {
    Remove-Item $distPath -Recurse -Force
}

# Create directories
New-Item -ItemType Directory -Path $distPath -Force | Out-Null
New-Item -ItemType Directory -Path $releasePath -Force | Out-Null

# Copy extension files
Write-Host "Copying extension files..." -ForegroundColor Yellow
Copy-Item -Path $extensionPath\* -Destination $releasePath -Recurse -Exclude @("*.md", "generate-icons.html")

# Update version in manifest
Write-Host "Updating manifest version to $Version..." -ForegroundColor Yellow
$manifestPath = Join-Path $releasePath "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifest.version = $Version
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath

# Generate icons if they don't exist
$iconPath = Join-Path $releasePath "icons"
$icon128 = Join-Path $iconPath "icon-128.png"

if (-not (Test-Path $icon128)) {
    Write-Host "Generating placeholder icons..." -ForegroundColor Yellow
    
    # Create icon directory if needed
    if (-not (Test-Path $iconPath)) {
        New-Item -ItemType Directory -Path $iconPath -Force | Out-Null
    }
    
    # Generate simple colored squares as placeholders
    Add-Type -AssemblyName System.Drawing
    
    @(16, 32, 48, 128) | ForEach-Object {
        $size = $_
        $bitmap = New-Object System.Drawing.Bitmap $size, $size
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        # Twitter blue background
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(29, 155, 240))
        $graphics.FillRectangle($brush, 0, 0, $size, $size)
        
        # White download arrow (simplified)
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ($size / 8)
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        
        # Arrow down
        $graphics.DrawLine($pen, $size/2, $size*0.2, $size/2, $size*0.6)
        $graphics.DrawLine($pen, $size*0.3, $size*0.4, $size/2, $size*0.6)
        $graphics.DrawLine($pen, $size*0.7, $size*0.4, $size/2, $size*0.6)
        
        # Base line
        $graphics.DrawLine($pen, $size*0.2, $size*0.8, $size*0.8, $size*0.8)
        
        $bitmap.Save((Join-Path $iconPath "icon-$size.png"))
        
        $graphics.Dispose()
        $bitmap.Dispose()
        $brush.Dispose()
        $pen.Dispose()
    }
    
    Write-Host "Icons generated!" -ForegroundColor Green
}

# Create installation instructions
Write-Host "Creating installation instructions..." -ForegroundColor Yellow
$instructions = @"
# XDL Extension Installation Guide

## Quick Install

1. Extract this folder to a permanent location
   Example: C:\Tools\xdl-extension\

2. Open Chrome or Edge

3. Navigate to:
   - Chrome: chrome://extensions/
   - Edge: edge://extensions/

4. Enable "Developer mode" (toggle in top right)

5. Click "Load unpacked"

6. Select this folder (xdl-extension-v$Version)

7. The extension icon will appear in your toolbar

## Usage

- Visit any Twitter/X video post
- Click the Download button that appears
- Or right-click and select "Download X Video"
- Or click the extension icon for more options

## Important Notes

- Do NOT delete this folder after installation
- The browser needs these files to run the extension
- To update: Download new version and repeat steps 5-6

## Troubleshooting

If the extension stops working:
1. Go to chrome://extensions/
2. Find XDL and click "Reload"

For more help: https://github.com/solatticus/xdl
"@

$instructions | Set-Content (Join-Path $releasePath "INSTALL.txt")

# Create ZIP package
Write-Host "`nCreating ZIP package..." -ForegroundColor Yellow
$zipPath = Join-Path $distPath "xdl-extension-v$Version.zip"

# Use .NET compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($releasePath, $zipPath)

# Create standalone installer batch file
Write-Host "Creating installer helper..." -ForegroundColor Yellow
$installerContent = @"
@echo off
title XDL Extension Installer Helper
color 0B

echo ============================================
echo    XDL Browser Extension Installer v$Version
echo ============================================
echo.
echo This helper will guide you through the installation.
echo.

:EXTRACT
echo Step 1: Extract the ZIP file
echo.
echo Please extract xdl-extension-v$Version.zip to a permanent location.
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
echo 4. Select the "xdl-extension-v$Version" folder
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
"@

$installerContent | Set-Content (Join-Path $distPath "INSTALL-HELPER.bat")

# Create JSON metadata for releases
$metadata = @{
    version = $Version
    date = (Get-Date).ToString("yyyy-MM-dd")
    files = @(
        "xdl-extension-v$Version.zip",
        "INSTALL-HELPER.bat"
    )
    sha256 = @{}
}

# Calculate checksums
Get-ChildItem $distPath -File | ForEach-Object {
    $hash = Get-FileHash $_.FullName -Algorithm SHA256
    $metadata.sha256[$_.Name] = $hash.Hash.ToLower()
}

$metadata | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $distPath "release-metadata.json")

# Summary
Write-Host "`n✅ Build Complete!" -ForegroundColor Green
Write-Host "`nCreated files:" -ForegroundColor Cyan
Write-Host "  - xdl-extension-v$Version.zip (distribute this)" -ForegroundColor White
Write-Host "  - INSTALL-HELPER.bat (optional installer assistant)" -ForegroundColor White
Write-Host "  - release-metadata.json (for GitHub releases)" -ForegroundColor White

Write-Host "`nOutput location:" -ForegroundColor Cyan
Write-Host "  $distPath" -ForegroundColor White

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Test the extension locally"
Write-Host "  2. Upload to GitHub releases"
Write-Host "  3. Share the download link!"

# Open output folder
Start-Process explorer.exe $distPath