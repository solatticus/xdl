# XDL Browser Extension

A browser extension for downloading videos from X/Twitter with a single click.

## ⚠️ Important Notice

This extension is for **personal use only** and will likely be rejected from official extension stores due to:
- Twitter/X Terms of Service violations
- Copyright concerns
- Third-party content downloading

## Features

- 🎯 **One-Click Download** - Download button integrated into Twitter/X UI
- 📊 **Quality Selection** - Choose video quality (when available)
- 🎨 **Native UI** - Matches Twitter/X's design perfectly
- 🌙 **Dark Mode** - Automatic theme detection
- 📍 **Multiple Access Points**:
  - Download button in tweet actions
  - Floating button on videos
  - Right-click context menu
  - Extension popup for quick downloads
- 🔔 **Download Notifications** - Get notified when downloads complete

## Installation (Developer Mode)

1. **Chrome/Edge:**
   - Navigate to `chrome://extensions/` or `edge://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `extension` folder

2. **Firefox:**
   - Navigate to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file

## Usage

### Method 1: Download Button
- Navigate to any tweet with a video
- Click the "Download" button that appears next to Like/Retweet/Share

### Method 2: Floating Button
- Hover over any video
- Click the download icon in the top-right corner

### Method 3: Right-Click
- Right-click on any video or tweet
- Select "Download X Video" from the context menu

### Method 4: Extension Popup
- Click the extension icon in your toolbar
- Paste a Twitter/X URL
- Click "Download"

## How It Works

1. **Syndication API**: Uses Twitter's public CDN endpoint (no auth required)
2. **Quality Detection**: Automatically selects the highest available quality
3. **Direct Download**: Downloads directly through the browser's download manager

## Permissions Required

- `activeTab` - To detect videos on current page
- `downloads` - To save videos
- `contextMenus` - For right-click functionality
- `storage` - To save user preferences
- `notifications` - For download status updates

## Privacy

- No data collection
- No external servers
- All processing happens locally
- Videos download directly from Twitter's CDN

## Troubleshooting

**Download fails:**
- Make sure the tweet contains a video (not a GIF)
- Try refreshing the page
- Check if the tweet is protected/private

**Button doesn't appear:**
- Refresh the Twitter/X page
- Disable other Twitter extensions that might conflict
- Re-enable the extension

## Development

```bash
# Watch for changes during development
cd extension
# Make changes to scripts/styles
# Reload extension in browser
```

## Legal Notice

This extension is provided "as is" for educational purposes. Users are responsible for complying with Twitter/X's Terms of Service and respecting content creators' rights.

## Contributing

Since this can't be published to stores, feel free to fork and modify for your personal use!