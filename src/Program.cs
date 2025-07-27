using System.Net.Http;
using System.Text.RegularExpressions;
using System.Web;

namespace Xdl;

class Program
{
    private static readonly HttpClient httpClient = new HttpClient();
    
    static async Task Main(string[] args)
    {
        if (args.Length > 0)
        {
            // Command-line mode
            string? url = null;
            
            // Parse arguments
            for (int i = 0; i < args.Length; i++)
            {
                if ((args[i] == "--url" || args[i] == "-u") && i + 1 < args.Length)
                {
                    url = args[i + 1];
                    break;
                }
                else if (!args[i].StartsWith("-"))
                {
                    url = args[i];
                    break;
                }
            }
            
            if (url == null)
            {
                Console.WriteLine("Usage: xdn [--url] <twitter_video_url>");
                Console.WriteLine("Example: xdn https://x.com/user/status/123456789");
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
            Console.WriteLine("X/Twitter Video Downloader");
            Console.WriteLine("==========================");
            
            while (true)
            {
                Console.Write("\nEnter Twitter/X video URL (or 'quit' to exit): ");
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
    
    static async Task DownloadVideo(string url)
    {
        Console.WriteLine("Fetching video information...");
        
        // Extract tweet ID
        var tweetIdMatch = Regex.Match(url, @"/status/(\d+)");
        if (!tweetIdMatch.Success)
        {
            throw new ArgumentException("Invalid Twitter/X URL format");
        }
        
        var tweetId = tweetIdMatch.Groups[1].Value;
        
        try
        {
            // Try multiple extraction methods
            string? videoUrl = null;
            
            // Method 1: Try syndication API (often works without auth)
            videoUrl = await TrySyndicationApi(tweetId);
            
            if (string.IsNullOrEmpty(videoUrl))
            {
                // Method 2: Try web scraping with proper headers
                videoUrl = await TryWebScraping(url);
            }
            
            if (videoUrl == null)
            {
                Console.WriteLine("Could not find video in the provided URL.");
                Console.WriteLine("This tweet might not contain a video, or Twitter may have changed their API.");
                return;
            }
            
            // Download the video
            await DownloadVideoFile(videoUrl, url);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }
    
    static async Task<string?> TrySyndicationApi(string tweetId)
    {
        try
        {
            Console.WriteLine("Trying syndication API...");
            
            // Twitter's syndication API - often works without authentication
            var syndicationUrl = $"https://cdn.syndication.twimg.com/tweet-result?id={tweetId}&lang=en&features=tfw_timeline_list%3A%3Btfw_follower_count_sunset%3Atrue%3Btfw_tweet_edit_backend%3Aon%3Btfw_refsrc_session%3Aon%3Btfw_fosnr_soft_interventions_enabled%3Aon%3Btfw_show_birdwatch_pivots_enabled%3Aon%3Btfw_show_business_verified_badge%3Aon%3Btfw_duplicate_scribes_to_settings%3Aon%3Btfw_use_profile_image_shape_enabled%3Aon%3Btfw_show_blue_verified_badge%3Aon%3Btfw_legacy_timeline_sunset%3Atrue%3Btfw_show_gov_verified_badge%3Aon%3Btfw_show_business_affiliate_badge%3Aon%3Btfw_tweet_edit_frontend%3Aon&token=4vemjcr3eq7";
            
            httpClient.DefaultRequestHeaders.Clear();
            httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            
            var response = await httpClient.GetAsync(syndicationUrl);
            var json = await response.Content.ReadAsStringAsync();
            
            // Look for video URLs in the response
            var videoMatches = Regex.Matches(json, @"""url"":""(https://video\.twimg\.com/[^""]+\.mp4[^""]*)""");
            if (videoMatches.Count > 0)
            {
                var urls = videoMatches.Select(m => m.Groups[1].Value.Replace("\\/", "/")).ToList();
                
                // Get highest quality
                var bestUrl = urls.OrderByDescending(u => 
                {
                    var resMatch = Regex.Match(u, @"/(\d+)x(\d+)/");
                    if (resMatch.Success)
                    {
                        return int.Parse(resMatch.Groups[1].Value) * int.Parse(resMatch.Groups[2].Value);
                    }
                    return 0;
                }).FirstOrDefault();
                
                if (bestUrl != null)
                {
                    Console.WriteLine("Found video via syndication API");
                    return bestUrl;
                }
            }
            
            // Also check for m3u8
            var m3u8Matches = Regex.Matches(json, @"""url"":""(https://video\.twimg\.com/[^""]+\.m3u8[^""]*)""");
            if (m3u8Matches.Count > 0)
            {
                var m3u8Url = m3u8Matches[0].Groups[1].Value.Replace("\\/", "/");
                Console.WriteLine("Found HLS stream via syndication API");
                return await GetMp4FromM3u8(m3u8Url);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Syndication API failed: {ex.Message}");
        }
        
        return null;
    }
    
    static async Task<string?> TryWebScraping(string url)
    {
        try
        {
            Console.WriteLine("Trying web scraping...");
            
            httpClient.DefaultRequestHeaders.Clear();
            httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            httpClient.DefaultRequestHeaders.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
            httpClient.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.5");
            
            var response = await httpClient.GetStringAsync(url);
            
            // Look for bearer token in the page
            var bearerMatch = Regex.Match(response, @"AAAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%]+");
            if (bearerMatch.Success)
            {
                Console.WriteLine("Found bearer token in page");
            }
            
            // Try to find video URLs
            var patterns = new[]
            {
                @"https://video\.twimg\.com/ext_tw_video/\d+/pu/vid/\d+x\d+/[^""'\s]+\.mp4",
                @"https://video\.twimg\.com/amplify_video/\d+/vid/\d+x\d+/[^""'\s]+\.mp4",
                @"""playbackUrl"":""(https://[^""]+\.mp4[^""]*)""",
                @"""url"":""(https://[^""]+\.mp4[^""]*)"""
            };
            
            foreach (var pattern in patterns)
            {
                var matches = Regex.Matches(response, pattern);
                if (matches.Count > 0)
                {
                    var videoUrl = matches[0].Groups.Count > 1 ? matches[0].Groups[1].Value : matches[0].Value;
                    videoUrl = videoUrl.Replace("\\/", "/");
                    Console.WriteLine("Found video URL via web scraping");
                    return videoUrl;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Web scraping failed: {ex.Message}");
        }
        
        return null;
    }
    
    static async Task<string?> GetMp4FromM3u8(string m3u8Url)
    {
        try
        {
            var m3u8Content = await httpClient.GetStringAsync(m3u8Url);
            
            // If it's a master playlist, get the highest quality stream
            if (m3u8Content.Contains("#EXT-X-STREAM-INF"))
            {
                var lines = m3u8Content.Split('\n');
                var maxBandwidth = 0;
                string? bestStreamUrl = null;
                
                for (int i = 0; i < lines.Length - 1; i++)
                {
                    if (lines[i].StartsWith("#EXT-X-STREAM-INF"))
                    {
                        var bandwidthMatch = Regex.Match(lines[i], @"BANDWIDTH=(\d+)");
                        if (bandwidthMatch.Success)
                        {
                            var bandwidth = int.Parse(bandwidthMatch.Groups[1].Value);
                            if (bandwidth > maxBandwidth)
                            {
                                maxBandwidth = bandwidth;
                                var streamPath = lines[i + 1].Trim();
                                bestStreamUrl = streamPath.StartsWith("http") ? streamPath : 
                                              m3u8Url.Substring(0, m3u8Url.LastIndexOf('/') + 1) + streamPath;
                            }
                        }
                    }
                }
                
                if (bestStreamUrl != null)
                {
                    m3u8Url = bestStreamUrl;
                }
            }
            
            // Convert m3u8 URL to mp4 URL (Twitter specific)
            var mp4Url = m3u8Url.Replace(".m3u8", ".mp4");
            if (mp4Url.Contains("/pl/"))
            {
                mp4Url = mp4Url.Replace("/pl/", "/vid/");
            }
            
            return mp4Url;
        }
        catch
        {
            return null;
        }
    }
    
    static async Task DownloadVideoFile(string videoUrl, string originalUrl)
    {
        Console.WriteLine($"Downloading video...");
        
        // Get downloads folder
        var downloadsPath = GetDownloadsFolder();
        
        // Generate filename from URL or timestamp
        var filename = GenerateFilename(originalUrl);
        var filePath = Path.Combine(downloadsPath, filename);
        
        // Download the video
        httpClient.DefaultRequestHeaders.Clear();
        httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        httpClient.DefaultRequestHeaders.Add("Referer", "https://twitter.com/");
        
        using var response = await httpClient.GetAsync(videoUrl, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        
        var totalBytes = response.Content.Headers.ContentLength ?? -1L;
        var canReportProgress = totalBytes != -1;
        
        // Download with progress reporting
        using var contentStream = await response.Content.ReadAsStreamAsync();
        using var fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);
        
        var buffer = new byte[8192];
        var totalRead = 0L;
        var read = 0;
        
        while ((read = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
        {
            await fileStream.WriteAsync(buffer, 0, read);
            totalRead += read;
            
            if (canReportProgress)
            {
                var progress = (totalRead * 100) / totalBytes;
                Console.Write($"\rProgress: {progress}% [{totalRead:N0}/{totalBytes:N0} bytes]");
            }
        }
        
        Console.WriteLine($"\n✓ Video saved to: {filePath}");
    }
    
    static string GetDownloadsFolder()
    {
        // Cross-platform downloads folder detection
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
            // Fallback to current directory
            return Environment.CurrentDirectory;
        }
    }
    
    static string GenerateFilename(string url)
    {
        // Extract tweet ID from URL if possible
        var tweetIdPattern = @"/status/(\d+)";
        var match = Regex.Match(url, tweetIdPattern);
        
        if (match.Success)
        {
            return $"twitter_video_{match.Groups[1].Value}.mp4";
        }
        
        // Fallback to timestamp
        return $"twitter_video_{DateTime.Now:yyyyMMdd_HHmmss}.mp4";
    }
}