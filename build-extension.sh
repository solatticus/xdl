#!/bin/bash
# XDL Extension Build Script for Linux/macOS
# Creates a distributable package for the browser extension

VERSION=${1:-"1.0.0"}

echo -e "\033[36mXDL Extension Builder v1.0\033[0m"
echo -e "\033[36m=========================\033[0m"

# Colors
YELLOW='\033[33m'
GREEN='\033[32m'
CYAN='\033[36m'
NC='\033[0m' # No Color

# Paths
ROOT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_PATH="$ROOT_PATH/extension"
DIST_PATH="$ROOT_PATH/dist"
RELEASE_PATH="$DIST_PATH/xdl-extension-v$VERSION"

# Clean previous builds
echo -e "\n${YELLOW}Cleaning previous builds...${NC}"
rm -rf "$DIST_PATH"

# Create directories
mkdir -p "$RELEASE_PATH"

# Copy extension files
echo -e "${YELLOW}Copying extension files...${NC}"
rsync -av --exclude='*.md' --exclude='generate-icons.html' "$EXTENSION_PATH/" "$RELEASE_PATH/"

# Update version in manifest
echo -e "${YELLOW}Updating manifest version to $VERSION...${NC}"
MANIFEST_PATH="$RELEASE_PATH/manifest.json"
if command -v jq &> /dev/null; then
    jq ".version = \"$VERSION\"" "$MANIFEST_PATH" > tmp.json && mv tmp.json "$MANIFEST_PATH"
else
    # Fallback for systems without jq
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$MANIFEST_PATH"
    rm -f "$MANIFEST_PATH.bak"
fi

# Check for icons
ICON_PATH="$RELEASE_PATH/icons"
if [ ! -f "$ICON_PATH/icon-128.png" ]; then
    echo -e "${YELLOW}Note: Icons not found. Please generate them manually.${NC}"
    mkdir -p "$ICON_PATH"
    
    # Create placeholder message
    echo "Please generate icons using extension/icons/generate-icons.html" > "$ICON_PATH/README.txt"
fi

# Create installation instructions
echo -e "${YELLOW}Creating installation instructions...${NC}"
cat > "$RELEASE_PATH/INSTALL.txt" << EOF
# XDL Extension Installation Guide

## Quick Install

1. Extract this folder to a permanent location
   Example: ~/Documents/xdl-extension/

2. Open Chrome or Edge

3. Navigate to:
   - Chrome: chrome://extensions/
   - Edge: edge://extensions/

4. Enable "Developer mode" (toggle in top right)

5. Click "Load unpacked"

6. Select this folder (xdl-extension-v$VERSION)

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
EOF

# Create ZIP package
echo -e "\n${YELLOW}Creating ZIP package...${NC}"
cd "$DIST_PATH"
zip -r "xdl-extension-v$VERSION.zip" "xdl-extension-v$VERSION"

# Create installer helper script
echo -e "${YELLOW}Creating installer helper...${NC}"
cat > "$DIST_PATH/install-helper.sh" << 'EOF'
#!/bin/bash
# XDL Extension Installer Helper

echo "============================================"
echo "   XDL Browser Extension Installer"
echo "============================================"
echo

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macOS"
    OPEN_CMD="open"
else
    PLATFORM="Linux"
    OPEN_CMD="xdg-open"
fi

echo "Platform detected: $PLATFORM"
echo

# Extract location
echo "Step 1: Extract the extension"
echo "Please extract xdl-extension-v*.zip to a permanent location"
echo "Recommended: ~/Documents/xdl-extension/"
echo
read -p "Press Enter once you've extracted the files..."

# Browser selection
echo
echo "Step 2: Choose your browser"
echo "1. Google Chrome"
echo "2. Microsoft Edge"
echo "3. Brave Browser"
echo "4. Chromium"
echo
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "Opening Chrome extensions page..."
        $OPEN_CMD "chrome://extensions/" 2>/dev/null || echo "Please open Chrome and go to chrome://extensions/"
        ;;
    2)
        echo "Opening Edge extensions page..."
        $OPEN_CMD "edge://extensions/" 2>/dev/null || echo "Please open Edge and go to edge://extensions/"
        ;;
    3)
        echo "Opening Brave extensions page..."
        $OPEN_CMD "brave://extensions/" 2>/dev/null || echo "Please open Brave and go to brave://extensions/"
        ;;
    4)
        echo "Opening Chromium extensions page..."
        $OPEN_CMD "chromium://extensions/" 2>/dev/null || echo "Please open Chromium and go to chromium://extensions/"
        ;;
esac

echo
echo "Step 3: Install the extension"
echo
echo "1. Enable 'Developer mode' using the toggle in the top right"
echo "2. Click 'Load unpacked'"
echo "3. Navigate to where you extracted the files"
echo "4. Select the 'xdl-extension-v*' folder"
echo "5. Click 'Select'"
echo
echo "The XDL icon should now appear in your toolbar!"
echo
read -p "Press Enter to open the help page..."

$OPEN_CMD "https://github.com/solatticus/xdl#browser-extension" 2>/dev/null

echo
echo "Installation complete! Enjoy XDL!"
EOF

chmod +x "$DIST_PATH/install-helper.sh"

# Create metadata
echo -e "${YELLOW}Creating metadata...${NC}"
cat > "$DIST_PATH/release-metadata.json" << EOF
{
  "version": "$VERSION",
  "date": "$(date +%Y-%m-%d)",
  "files": [
    "xdl-extension-v$VERSION.zip",
    "install-helper.sh"
  ]
}
EOF

# Summary
echo -e "\n${GREEN}✅ Build Complete!${NC}"
echo -e "\n${CYAN}Created files:${NC}"
echo -e "  - xdl-extension-v$VERSION.zip (distribute this)"
echo -e "  - install-helper.sh (optional installer assistant)"
echo -e "  - release-metadata.json (for GitHub releases)"

echo -e "\n${CYAN}Output location:${NC}"
echo -e "  $DIST_PATH"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "  1. Test the extension locally"
echo "  2. Upload to GitHub releases"
echo "  3. Share the download link!"

# Open output folder
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$DIST_PATH"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$DIST_PATH"
fi