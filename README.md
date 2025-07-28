# 🎬 XDL - Universal Video Downloader

<div align="center">
  
  [![.NET](https://img.shields.io/badge/.NET-9.0-512BD4?style=for-the-badge&logo=dotnet)](https://dotnet.microsoft.com/)
  [![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=for-the-badge)](https://github.com/solatticus/xdl)
  [![License](https://img.shields.io/badge/License-Unlicense-green?style=for-the-badge)](LICENSE)
  
  <p align="center">
    <strong>A fast, modern command-line tool to download videos from multiple platforms</strong>
  </p>
  
  <p align="center">
    Supports X/Twitter, Rumble, and YouTube • Built with the latest .NET stream APIs
  </p>

</div>

---

## ✨ Features

- 🌐 **Multi-Platform Support** - Download from X/Twitter, Rumble, and YouTube
- 🚀 **Fast Downloads** - Uses modern async streams for optimal performance
- 📊 **Progress Tracking** - Real-time download progress with speed stats
- 🎯 **Smart Detection** - Automatically finds the highest quality video available
- 🖥️ **Cross-Platform** - Works on Windows, macOS, and Linux
- 📁 **Auto-Save** - Downloads directly to your system's Downloads folder
- 🔧 **Simple CLI** - Clean command-line interface with minimal setup
- 🎨 **Interactive Mode** - User-friendly interface for easy video downloading

## 🛠️ Installation

### Prerequisites

- [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0) or later

### Build from Source

```bash
# Clone the repository
git clone https://github.com/solatticus/xdl.git
cd xdl

# Build the project (from root, we have a solution file!)
dotnet build -c Release

# Create a self-contained executable
cd src
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

**📁 Output:** Your executable will be at: `src/bin/Release/net9.0/win-x64/publish/Xdl.exe`

For other platforms:
- **Linux**: `-r linux-x64` → `Xdl`
- **macOS Intel**: `-r osx-x64` → `Xdl`
- **macOS Apple Silicon**: `-r osx-arm64` → `Xdl`

### Quick Build Commands

```bash
# Windows
cd src && dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true

# Linux/macOS
cd src && dotnet publish -c Release -r linux-x64 --self-contained -p:PublishSingleFile=true
```

## 📖 Usage

### Command Line

```bash
# Download a video by URL
xdl https://x.com/user/status/1234567890123456789
xdl https://rumble.com/v2h8qwe-example-video.html
xdl https://youtube.com/watch?v=dQw4w9WgXcQ

# Or use the --url flag
xdl --url https://x.com/user/status/1234567890123456789
```

### Interactive Mode

```bash
# Run without arguments for interactive mode
xdl

╔═══════════════════════════════════════╗
║        XDL - Video Downloader         ║
║                                       ║
║  Supported platforms:                 ║
║  • X/Twitter                          ║
║  • Rumble                             ║
║  • YouTube (requires yt-dlp)          ║
╚═══════════════════════════════════════╝

Enter video URL (or 'quit' to exit): https://x.com/user/status/123...
```

## 🏗️ Architecture

XDL uses a platform-specific approach for each supported site:

### X/Twitter
1. **Syndication API** - Primary method using Twitter's CDN endpoints
2. **Web Scraping** - Fallback method with proper headers

### Rumble
1. **JSON-LD Extraction** - Searches for video URLs in structured data
2. **Embed Page Parsing** - Fallback to parsing embed pages

### YouTube
- **yt-dlp Integration** - Leverages the powerful yt-dlp tool for reliable YouTube downloads

### Technical Details

- Built with **.NET 9.0** using the latest C# features
- Utilizes `HttpClient` with `HttpCompletionOption.ResponseHeadersRead` for memory-efficient streaming
- Implements async/await patterns throughout for non-blocking I/O
- Smart resolution detection to download the highest quality available

## 📋 Requirements

- .NET 9.0 Runtime (included in self-contained builds)
- Internet connection
- Write access to Downloads folder
- **For YouTube**: [yt-dlp](https://github.com/yt-dlp/yt-dlp) must be installed

## ⚠️ Disclaimer

This tool is for personal use only. Please respect content creators' rights and the Terms of Service of each platform:

- Only download videos you have permission to save
- Don't use for mass downloading or automation
- Respect copyright and intellectual property rights
- This tool is not affiliated with X Corp., Rumble, or YouTube

## 🔄 Browser Extension

XDL includes a browser extension for one-click video downloads. See the [extension folder](extension/) for details.

### Update Extension

To update the extension after making changes:

```batch
update-extension.bat
```

This will:
1. Open your browser's extensions page
2. Show you exactly where to click
3. The extension reloads with your latest changes

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is released into the public domain under The Unlicense - see the [LICENSE](LICENSE) file for details.

This means you can use this code for ANY purpose, commercial or non-commercial, without any restrictions or attribution requirements.

## 🙏 Acknowledgments

- Built with the [.NET Platform](https://dotnet.microsoft.com/)
- Inspired by the need for a simple, modern video downloader
- Thanks to all contributors and users

---

<div align="center">
  <p>Made with ❤️ using .NET</p>
  <p>
    <a href="https://github.com/yourusername/xdn/issues">Report Bug</a>
    •
    <a href="https://github.com/yourusername/xdn/issues">Request Feature</a>
  </p>
</div>