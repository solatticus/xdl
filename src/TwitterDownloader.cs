using System.Net.Http;
using System.Text.RegularExpressions;

namespace Xdl;

/// <summary>
/// Twitter/X specific video extraction logic
/// </summary>
static class TwitterDownloader
{
    public static async Task<(string? videoUrl, string filename)> ExtractVideo(string url, HttpClient httpClient)
    {
        // Extract tweet ID from URL
        var tweetIdMatch = Regex.Match(url, @"/status/(\d+)");
        if (!tweetIdMatch.Success)
        {
            throw new ArgumentException("Invalid Twitter/X URL format");
        }
        
        var tweetId = tweetIdMatch.Groups[1].Value;
        
        // Try syndication API first
        var videoUrl = await TrySyndicationApi(tweetId, httpClient);
        
        if (videoUrl == null)
        {
            // Fallback to web scraping
            videoUrl = await TryWebScraping(url, httpClient);
        }
        
        var filename = $"twitter_video_{tweetId}.mp4";
        return (videoUrl, filename);
    }
    
    static async Task<string?> TrySyndicationApi(string tweetId, HttpClient httpClient)
    {
        try
        {
            Console.WriteLine("Trying Twitter syndication API...");
            
            var syndicationUrl = $"https://cdn.syndication.twimg.com/tweet-result?id={tweetId}&lang=en&features=tfw_timeline_list%3A%3Btfw_follower_count_sunset%3Atrue%3Btfw_tweet_edit_backend%3Aon%3Btfw_refsrc_session%3Aon%3Btfw_fosnr_soft_interventions_enabled%3Aon%3Btfw_show_birdwatch_pivots_enabled%3Aon%3Btfw_show_business_verified_badge%3Aon%3Btfw_duplicate_scribes_to_settings%3Aon%3Btfw_use_profile_image_shape_enabled%3Aon%3Btfw_show_blue_verified_badge%3Aon%3Btfw_legacy_timeline_sunset%3Atrue%3Btfw_show_gov_verified_badge%3Aon%3Btfw_show_business_affiliate_badge%3Aon%3Btfw_tweet_edit_frontend%3Aon&token=4vemjcr3eq7";
            
            httpClient.DefaultRequestHeaders.Clear();
            httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            
            var response = await httpClient.GetAsync(syndicationUrl);
            var json = await response.Content.ReadAsStringAsync();
            
            // Look for video URLs
            var videoMatches = Regex.Matches(json, @"""url"":""(https://video\.twimg\.com/[^""]+\.mp4[^""]*)""");
            if (videoMatches.Count > 0)
            {
                var urls = videoMatches.Select(m => m.Groups[1].Value.Replace("\\/", "/")).ToList();
                
                // Get highest quality - prioritize by resolution and bitrate
                var bestUrl = urls.OrderByDescending(u => 
                {
                    // Extract resolution and bitrate from URL
                    // URLs typically look like: /ext_tw_video/123/pu/vid/1280x720/abc.mp4?tag=12
                    // or with bitrate: /ext_tw_video/123/pu/vid/avc1/1280x720/2000000/abc.mp4
                    var resMatch = Regex.Match(u, @"/(\d+)x(\d+)");
                    var bitrateMatch = Regex.Match(u, @"/\d+x\d+/(\d{6,})/"); // Bitrate after resolution
                    
                    if (resMatch.Success)
                    {
                        var width = int.Parse(resMatch.Groups[1].Value);
                        var height = int.Parse(resMatch.Groups[2].Value);
                        var pixels = width * height;
                        
                        // If bitrate is present, use it as a secondary sort
                        if (bitrateMatch.Success)
                        {
                            if (long.TryParse(bitrateMatch.Groups[1].Value, out var bitrate))
                            {
                                // Combine pixels and bitrate for scoring (scale down bitrate to avoid overflow)
                                return (long)pixels * 1000000 + (bitrate / 1000);
                            }
                        }
                        
                        // Check for codec preference (avc1 is usually higher quality)
                        if (u.Contains("/avc1/"))
                            return (long)pixels * 1000000 + 500000; // Bonus for AVC1
                            
                        return (long)pixels * 1000000;
                    }
                    return 0;
                }).FirstOrDefault();
                
                if (bestUrl != null)
                {
                    // Show quality information
                    var resMatch = Regex.Match(bestUrl, @"/(\d+)x(\d+)");
                    // Only match bitrate after resolution pattern
                    var bitrateMatch = Regex.Match(bestUrl, @"/\d+x\d+/(\d{6,})/");
                    
                    Console.Write("Found video via syndication API");
                    if (resMatch.Success)
                    {
                        Console.Write($" - {resMatch.Groups[1].Value}x{resMatch.Groups[2].Value}");
                        if (bitrateMatch.Success && long.TryParse(bitrateMatch.Groups[1].Value, out var bitrate))
                        {
                            var bitrateMbps = bitrate / 1000000.0;
                            Console.Write($" @ {bitrateMbps:F1} Mbps");
                        }
                    }
                    Console.WriteLine();
                    
                    // Debug: Show all available qualities
                    if (urls.Count > 1)
                    {
                        Console.WriteLine($"Available qualities: {urls.Count}");
                        var qualityList = new List<(int width, int height, string url)>();
                        
                        foreach (var url in urls)
                        {
                            var rm = Regex.Match(url, @"/(\d+)x(\d+)");
                            if (rm.Success)
                            {
                                var width = int.Parse(rm.Groups[1].Value);
                                var height = int.Parse(rm.Groups[2].Value);
                                qualityList.Add((width, height, url));
                            }
                        }
                        
                        // Sort by resolution descending
                        foreach (var q in qualityList.OrderByDescending(x => x.width * x.height))
                        {
                            var filename = q.url.Substring(q.url.LastIndexOf('/') + 1);
                            if (filename.Contains('?'))
                                filename = filename.Substring(0, filename.IndexOf('?'));
                            Console.WriteLine($"  - {q.width}x{q.height}: {filename}");
                        }
                    }
                    
                    return bestUrl;
                }
            }
            
            // Check for m3u8
            var m3u8Matches = Regex.Matches(json, @"""url"":""(https://video\.twimg\.com/[^""]+\.m3u8[^""]*)""");
            if (m3u8Matches.Count > 0)
            {
                var m3u8Url = m3u8Matches[0].Groups[1].Value.Replace("\\/", "/");
                Console.WriteLine("Found HLS stream via syndication API");
                return await GetMp4FromM3u8(m3u8Url, httpClient);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Syndication API failed: {ex.Message}");
        }
        
        return null;
    }
    
    static async Task<string?> TryWebScraping(string url, HttpClient httpClient)
    {
        try
        {
            Console.WriteLine("Trying web scraping fallback...");
            
            httpClient.DefaultRequestHeaders.Clear();
            httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            httpClient.DefaultRequestHeaders.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
            httpClient.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.5");
            
            var response = await httpClient.GetStringAsync(url);
            
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
    
    static async Task<string?> GetMp4FromM3u8(string m3u8Url, HttpClient httpClient)
    {
        try
        {
            Console.WriteLine("Processing HLS stream...");
            var m3u8Content = await httpClient.GetStringAsync(m3u8Url);
            
            if (m3u8Content.Contains("#EXT-X-STREAM-INF"))
            {
                var lines = m3u8Content.Split('\n');
                var maxBandwidth = 0;
                string? bestStreamUrl = null;
                var streamCount = 0;
                
                // Find all streams and their bandwidths
                var streams = new List<(int bandwidth, string url, string? resolution)>();
                
                for (int i = 0; i < lines.Length - 1; i++)
                {
                    if (lines[i].StartsWith("#EXT-X-STREAM-INF"))
                    {
                        streamCount++;
                        var bandwidthMatch = Regex.Match(lines[i], @"BANDWIDTH=(\d+)");
                        var resolutionMatch = Regex.Match(lines[i], @"RESOLUTION=(\d+x\d+)");
                        
                        if (bandwidthMatch.Success)
                        {
                            var bandwidth = int.Parse(bandwidthMatch.Groups[1].Value);
                            var resolution = resolutionMatch.Success ? resolutionMatch.Groups[1].Value : null;
                            var streamPath = lines[i + 1].Trim();
                            var streamUrl = streamPath.StartsWith("http") ? streamPath : 
                                          m3u8Url.Substring(0, m3u8Url.LastIndexOf('/') + 1) + streamPath;
                            
                            streams.Add((bandwidth, streamUrl, resolution));
                            
                            if (bandwidth > maxBandwidth)
                            {
                                maxBandwidth = bandwidth;
                                bestStreamUrl = streamUrl;
                            }
                        }
                    }
                }
                
                if (bestStreamUrl != null)
                {
                    Console.WriteLine($"Found {streamCount} HLS variants");
                    var bestStream = streams.FirstOrDefault(s => s.url == bestStreamUrl);
                    if (bestStream.resolution != null)
                    {
                        var bitrateMbps = bestStream.bandwidth / 1000000.0;
                        Console.WriteLine($"Selected highest quality: {bestStream.resolution} @ {bitrateMbps:F1} Mbps");
                    }
                    m3u8Url = bestStreamUrl;
                }
            }
            
            // Twitter-specific conversion
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
}