using System.Net.Http;
using System.Text.RegularExpressions;

namespace Xdl;

/// <summary>
/// XDL - Universal Video Downloader
/// Supports: X/Twitter, Rumble, YouTube*
/// 
/// Architecture: Platform detection → Platform-specific handler → Common downloader
/// </summary>
class Program
{
    private static readonly HttpClient httpClient = new HttpClient();
    
    // Platform detection patterns
    private static readonly Dictionary<string, Regex> platformPatterns = new()
    {
        ["twitter"] = new Regex(@"(?:twitter\.com|x\.com)/\w+/status/\d+", RegexOptions.IgnoreCase),
        ["rumble"] = new Regex(@"rumble\.com/(?:embed/)?(?:v[a-z0-9]+|[^/]+\.html)", RegexOptions.IgnoreCase),
        ["youtube"] = new Regex(@"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)[\w-]+", RegexOptions.IgnoreCase)
    };
    
    static async Task Main(string[] args)
    {
        if (args.Length > 0)
        {
            // CLI mode
            string? url = ParseArguments(args);
            
            if (url == null)
            {
                ShowUsage();
                Environment.Exit(1);
            }
            
            try
            {
                await DownloadVideo(url);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
                Environment.Exit(1);
            }
        }
        else
        {
            // Interactive mode
            ShowBanner();
            
            while (true)
            {
                Console.Write("\nEnter video URL (or 'quit' to exit): ");
                var input = Console.ReadLine();
                
                if (input == null || input.Trim().ToLower() == "quit")
                    break;
                
                try
                {
                    await DownloadVideo(input);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error: {ex.Message}");
                }
            }
        }
    }
    
    static string? ParseArguments(string[] args)
    {
        for (int i = 0; i < args.Length; i++)
        {
            if ((args[i] == "--url" || args[i] == "-u") && i + 1 < args.Length)
            {
                return args[i + 1];
            }
            else if (!args[i].StartsWith("-"))
            {
                return args[i];
            }
        }
        return null;
    }
    
    static void ShowBanner()
    {
        Console.WriteLine(@"
╔═══════════════════════════════════════╗
║        XDL - Video Downloader         ║
║                                       ║
║  Supported platforms:                 ║
║  • X/Twitter                          ║
║  • Rumble                             ║
║  • YouTube (requires yt-dlp)          ║
╚═══════════════════════════════════════╝");
    }
    
    static void ShowUsage()
    {
        Console.WriteLine("Usage: xdl [--url] <video_url>");
        Console.WriteLine("\nExamples:");
        Console.WriteLine("  xdl https://x.com/user/status/123456789");
        Console.WriteLine("  xdl https://rumble.com/v2r8qwo-example.html");
        Console.WriteLine("  xdl https://youtube.com/watch?v=dQw4w9WgXcQ");
    }
    
    /// <summary>
    /// Main download orchestrator - detects platform and routes to appropriate handler
    /// </summary>
    static async Task DownloadVideo(string url)
    {
        Console.WriteLine("Detecting platform...");
        
        var platform = DetectPlatform(url);
        if (platform == null)
        {
            throw new ArgumentException("Unsupported URL. Supported: Twitter/X, Rumble, YouTube");
        }
        
        Console.WriteLine($"Platform: {platform}");
        
        string? videoUrl = null;
        string? filename = null;
        
        switch (platform)
        {
            case "twitter":
                (videoUrl, filename) = await TwitterDownloader.ExtractVideo(url, httpClient);
                break;
                
            case "rumble":
                (videoUrl, filename) = await RumbleDownloader.ExtractVideo(url, httpClient);
                break;
                
            case "youtube":
                await YouTubeDownloader.DownloadWithYtDlp(url);
                return; // yt-dlp handles everything
                
            default:
                throw new NotSupportedException($"Platform {platform} not implemented");
        }
        
        if (videoUrl == null)
        {
            throw new Exception("Could not extract video URL");
        }
        
        await CommonDownloader.DownloadFile(videoUrl, filename, url, httpClient);
    }
    
    static string? DetectPlatform(string url)
    {
        foreach (var platform in platformPatterns)
        {
            if (platform.Value.IsMatch(url))
            {
                return platform.Key;
            }
        }
        return null;
    }
}

/// <summary>
/// Common download functionality used by all platforms
/// </summary>
static class CommonDownloader
{
    public static async Task DownloadFile(string videoUrl, string filename, string originalUrl, HttpClient httpClient)
    {
        Console.WriteLine($"Downloading video...");
        
        var downloadsPath = GetDownloadsFolder();
        var filePath = Path.Combine(downloadsPath, filename);
        
        // Check if file already exists
        if (File.Exists(filePath))
        {
            Console.Write($"File {filename} already exists. Overwrite? (y/n): ");
            var userResponse = Console.ReadLine()?.ToLower();
            if (userResponse != "y")
            {
                Console.WriteLine("Download cancelled.");
                return;
            }
        }
        
        httpClient.DefaultRequestHeaders.Clear();
        httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        httpClient.DefaultRequestHeaders.Add("Referer", GetRefererForUrl(originalUrl));
        
        using var response = await httpClient.GetAsync(videoUrl, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        
        var totalBytes = response.Content.Headers.ContentLength ?? -1L;
        var canReportProgress = totalBytes != -1;
        
        using var contentStream = await response.Content.ReadAsStreamAsync();
        using var fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);
        
        var buffer = new byte[8192];
        var totalRead = 0L;
        var read = 0;
        var lastProgressUpdate = DateTime.Now;
        
        while ((read = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
        {
            await fileStream.WriteAsync(buffer, 0, read);
            totalRead += read;
            
            // Update progress every 100ms to reduce console spam
            if (canReportProgress && (DateTime.Now - lastProgressUpdate).TotalMilliseconds > 100)
            {
                var progress = (totalRead * 100) / totalBytes;
                Console.Write($"\rProgress: {progress}% [{FormatBytes(totalRead)}/{FormatBytes(totalBytes)}]");
                lastProgressUpdate = DateTime.Now;
            }
        }
        
        Console.WriteLine($"\n✓ Video saved to: {filePath}");
    }
    
    static string GetRefererForUrl(string url)
    {
        if (url.Contains("twitter.com") || url.Contains("x.com"))
            return "https://twitter.com/";
        if (url.Contains("rumble.com"))
            return "https://rumble.com/";
        if (url.Contains("youtube.com") || url.Contains("youtu.be"))
            return "https://www.youtube.com/";
        return url;
    }
    
    public static string GetDownloadsFolder()
    {
        if (OperatingSystem.IsWindows())
        {
            return Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) + @"\Downloads";
        }
        else if (OperatingSystem.IsMacOS() || OperatingSystem.IsLinux())
        {
            var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            return Path.Combine(home, "Downloads");
        }
        else
        {
            return Environment.CurrentDirectory;
        }
    }
    
    static string FormatBytes(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB" };
        int order = 0;
        double size = bytes;
        
        while (size >= 1024 && order < sizes.Length - 1)
        {
            order++;
            size /= 1024;
        }
        
        return $"{size:0.##} {sizes[order]}";
    }
}

/// <summary>
/// Rumble-specific video extraction
/// </summary>
static class RumbleDownloader
{
    public static async Task<(string? videoUrl, string filename)> ExtractVideo(string url, HttpClient httpClient)
    {
        Console.WriteLine("Fetching Rumble video information...");
        
        httpClient.DefaultRequestHeaders.Clear();
        httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        
        var html = await httpClient.GetStringAsync(url);
        
        // Method 1: Look for mp4 URLs in JSON-LD data
        var mp4Pattern = @"""contentUrl""\s*:\s*""(https://[^""]+\.mp4)""";
        var mp4Match = Regex.Match(html, mp4Pattern);
        
        if (mp4Match.Success)
        {
            var videoUrl = mp4Match.Groups[1].Value;
            var filename = GenerateFilename(url);
            Console.WriteLine("Found direct MP4 URL");
            return (videoUrl, filename);
        }
        
        // Method 2: Look for embedUrl and fetch that
        var embedPattern = @"""embedUrl""\s*:\s*""(https://rumble\.com/embed/[^""]+)""";
        var embedMatch = Regex.Match(html, embedPattern);
        
        if (embedMatch.Success)
        {
            var embedUrl = embedMatch.Groups[1].Value;
            var embedHtml = await httpClient.GetStringAsync(embedUrl);
            
            // Look for video sources in embed page
            var sourcePattern = @"""[^""]*\.mp4[^""]*""";
            var sourceMatches = Regex.Matches(embedHtml, sourcePattern);
            
            foreach (Match match in sourceMatches)
            {
                var potentialUrl = match.Value.Trim('"');
                if (potentialUrl.StartsWith("http"))
                {
                    var filename = GenerateFilename(url);
                    Console.WriteLine("Found video URL in embed page");
                    return (potentialUrl, filename);
                }
            }
        }
        
        // Method 3: Look for data-video attribute
        var dataVideoPattern = @"data-video-url=""([^""]+)""";
        var dataVideoMatch = Regex.Match(html, dataVideoPattern);
        
        if (dataVideoMatch.Success)
        {
            var videoUrl = dataVideoMatch.Groups[1].Value;
            var filename = GenerateFilename(url);
            return (videoUrl, filename);
        }
        
        return (null, "");
    }
    
    static string GenerateFilename(string url)
    {
        // Extract video ID or title from URL
        var titleMatch = Regex.Match(url, @"/([^/]+)\.html");
        if (titleMatch.Success)
        {
            var title = titleMatch.Groups[1].Value;
            // Clean up title for filename
            title = Regex.Replace(title, @"[^\w\-_]", "_");
            return $"rumble_{title}.mp4";
        }
        
        return $"rumble_video_{DateTime.Now:yyyyMMdd_HHmmss}.mp4";
    }
}

/// <summary>
/// YouTube downloader using yt-dlp
/// </summary>
static class YouTubeDownloader
{
    public static async Task DownloadWithYtDlp(string url)
    {
        Console.WriteLine("YouTube detected. Checking for yt-dlp...");
        
        // Check if yt-dlp is available
        var ytDlpCheck = await RunCommand("yt-dlp", "--version");
        if (!ytDlpCheck.success)
        {
            Console.WriteLine("\n⚠️  yt-dlp is required for YouTube downloads");
            Console.WriteLine("\nInstall yt-dlp:");
            Console.WriteLine("  Windows: winget install yt-dlp");
            Console.WriteLine("  Mac/Linux: pip install yt-dlp");
            Console.WriteLine("  Or download from: https://github.com/yt-dlp/yt-dlp/releases");
            return;
        }
        
        Console.WriteLine($"Using yt-dlp {ytDlpCheck.output.Trim()}");
        
        // Download with yt-dlp
        var downloadPath = CommonDownloader.GetDownloadsFolder();
        var args = $"-f \"bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best\" -o \"{downloadPath}/%(title)s.%(ext)s\" \"{url}\"";
        
        Console.WriteLine("Downloading with yt-dlp...");
        var result = await RunCommand("yt-dlp", args, showOutput: true);
        
        if (!result.success)
        {
            Console.WriteLine("Download failed. Try updating yt-dlp: yt-dlp -U");
        }
    }
    
    static async Task<(bool success, string output)> RunCommand(string command, string args, bool showOutput = false)
    {
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = command,
                Arguments = args,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };
            
            using var process = System.Diagnostics.Process.Start(psi);
            if (process == null) return (false, "Failed to start process");
            
            if (showOutput)
            {
                // Stream output in real-time
                while (!process.StandardOutput.EndOfStream)
                {
                    var line = await process.StandardOutput.ReadLineAsync();
                    if (line != null) Console.WriteLine(line);
                }
            }
            
            var output = showOutput ? "" : await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();
            
            return (process.ExitCode == 0, output);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }
}