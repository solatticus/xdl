/**
 * Background Service Worker
 * Handles API calls, downloads, and communication with content scripts
 */

// Keep service worker alive
self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// Download queue management
const downloadQueue = new Map();
const activeDownloads = new Map();

// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'download-video',
    title: 'Download Video with XDL',
    contexts: ['page', 'video', 'image'],
    documentUrlPatterns: [
      '*://twitter.com/*', '*://x.com/*',
      '*://youtube.com/*', '*://youtu.be/*',
      '*://rumble.com/*'
    ]
  });
  
  chrome.contextMenus.create({
    id: 'download-hd',
    parentId: 'download-video',
    title: 'Download HD Quality',
    contexts: ['page', 'video', 'image']
  });
  
  chrome.contextMenus.create({
    id: 'download-sd',
    parentId: 'download-video',
    title: 'Download SD Quality',
    contexts: ['page', 'video', 'image']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const quality = info.menuItemId === 'download-hd' ? 'high' : 'low';
  
  // Detect platform
  let platform = null;
  let videoId = null;
  
  if (tab.url.includes('twitter.com') || tab.url.includes('x.com')) {
    platform = 'twitter';
    const match = tab.url.match(/\/status\/(\d+)/);
    if (!match) {
      showNotification('Invalid URL', 'Navigate to a Twitter/X video post.');
      return;
    }
    videoId = match[1];
  } else if (tab.url.includes('youtube.com') || tab.url.includes('youtu.be')) {
    platform = 'youtube';
    showNotification('YouTube Info', 'YouTube requires yt-dlp. Use: xdl "' + tab.url + '"');
    return;
  } else if (tab.url.includes('rumble.com')) {
    platform = 'rumble';
    showNotification('Rumble Info', 'Use XDL command line: xdl "' + tab.url + '"');
    return;
  }
  
  if (platform && videoId) {
    await downloadVideo(videoId, tab.url, platform, quality);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    // Handle different platforms
    if (request.platform === 'youtube') {
      // For YouTube, just show instructions since it needs yt-dlp
      showNotification('YouTube Download', 'Use XDL command line with yt-dlp installed');
      sendResponse({ error: 'YouTube requires yt-dlp. Use command line: xdl "' + request.url + '"' });
      return true;
    }
    
    // For Twitter and Rumble, use the download function
    const videoId = request.videoId || request.tweetId; // Support both old and new format
    downloadVideo(videoId, request.url, request.platform || 'twitter', request.quality)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getDownloads') {
    sendResponse({
      queue: Array.from(downloadQueue.values()),
      active: Array.from(activeDownloads.values())
    });
  }
});

/**
 * Main download function supporting multiple platforms
 */
async function downloadVideo(videoId, videoUrl, platform = 'twitter', quality = 'high') {
  try {
    // Check if already downloading
    if (activeDownloads.has(videoId)) {
      showNotification('Already Downloading', 'This video is already being downloaded.');
      return { error: 'Already downloading' };
    }
    
    // Add to active downloads
    activeDownloads.set(videoId, {
      videoId,
      url: videoUrl,
      platform,
      status: 'fetching',
      progress: 0
    });
    
    let downloadUrl = null;
    let filename = '';
    
    // Platform-specific handling
    switch (platform) {
      case 'twitter':
        downloadUrl = await fetchVideoUrl(videoId);
        filename = `twitter_video_${videoId}.mp4`;
        break;
        
      case 'rumble':
        // For Rumble, we can't easily extract from extension
        // Direct user to use CLI
        activeDownloads.delete(videoId);
        showNotification('Rumble Download', 'Use XDL command line for Rumble videos');
        return { error: 'Rumble videos require XDL CLI. Use: xdl "' + videoUrl + '"' };
        
      default:
        activeDownloads.delete(videoId);
        return { error: 'Unsupported platform' };
    }
    
    if (!downloadUrl) {
      activeDownloads.delete(videoId);
      showNotification('No Video Found', 'Could not find a video URL.');
      return { error: 'No video found' };
    }
    
    // Start download
    chrome.downloads.download({
      url: downloadUrl,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        activeDownloads.delete(videoId);
        showNotification('Download Failed', chrome.runtime.lastError.message);
        return;
      }
      
      // Track download progress
      activeDownloads.set(videoId, {
        videoId,
        url: videoUrl,
        downloadId,
        status: 'downloading',
        progress: 0
      });
      
      showNotification('Download Started', `Downloading ${filename}`);
    });
    
    return { success: true, videoUrl: downloadUrl };
    
  } catch (error) {
    activeDownloads.delete(videoId);
    console.error('Download error:', error);
    showNotification('Download Error', error.message);
    return { error: error.message };
  }
}

/**
 * Fetch video URL using Twitter's syndication API
 */
async function fetchVideoUrl(tweetId) {
  const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&features=tfw_timeline_list%3A%3Btfw_follower_count_sunset%3Atrue%3Btfw_tweet_edit_backend%3Aon%3Btfw_refsrc_session%3Aon%3Btfw_fosnr_soft_interventions_enabled%3Aon%3Btfw_show_birdwatch_pivots_enabled%3Aon%3Btfw_show_business_verified_badge%3Aon%3Btfw_duplicate_scribes_to_settings%3Aon%3Btfw_use_profile_image_shape_enabled%3Aon%3Btfw_show_blue_verified_badge%3Aon%3Btfw_legacy_timeline_sunset%3Atrue%3Btfw_show_gov_verified_badge%3Aon%3Btfw_show_business_affiliate_badge%3Aon%3Btfw_tweet_edit_frontend%3Aon&token=4vemjcr3eq7`;
  
  try {
    const response = await fetch(syndicationUrl);
    const text = await response.text();
    
    // Extract video URLs using regex
    const videoRegex = /"url":"(https:\/\/video\.twimg\.com\/[^"]+\.mp4[^"]*)"/g;
    const matches = [...text.matchAll(videoRegex)];
    
    if (matches.length === 0) {
      // Try m3u8 format
      const m3u8Regex = /"url":"(https:\/\/video\.twimg\.com\/[^"]+\.m3u8[^"]*)"/g;
      const m3u8Matches = [...text.matchAll(m3u8Regex)];
      
      if (m3u8Matches.length > 0) {
        // Convert m3u8 to mp4 (Twitter-specific hack)
        let m3u8Url = m3u8Matches[0][1].replace(/\\/g, '');
        return m3u8Url.replace('.m3u8', '.mp4').replace('/pl/', '/vid/');
      }
      
      return null;
    }
    
    // Get all video URLs and sort by quality
    const videoUrls = matches.map(m => m[1].replace(/\\/g, ''));
    
    // Sort by resolution (embedded in URL like /720x1280/)
    const sortedUrls = videoUrls.sort((a, b) => {
      const resA = a.match(/\/(\d+)x(\d+)\//);
      const resB = b.match(/\/(\d+)x(\d+)\//);
      
      if (resA && resB) {
        const pixelsA = parseInt(resA[1]) * parseInt(resA[2]);
        const pixelsB = parseInt(resB[1]) * parseInt(resB[2]);
        return pixelsB - pixelsA;
      }
      
      return 0;
    });
    
    return sortedUrls[0]; // Return highest quality
    
  } catch (error) {
    console.error('API fetch error:', error);
    return null;
  }
}

/**
 * Monitor download progress
 */
chrome.downloads.onChanged.addListener((delta) => {
  // Find the download in our active downloads
  const download = Array.from(activeDownloads.values())
    .find(d => d.downloadId === delta.id);
  
  if (!download) return;
  
  if (delta.state) {
    if (delta.state.current === 'complete') {
      activeDownloads.delete(download.tweetId);
      showNotification('Download Complete', `twitter_video_${download.tweetId}.mp4 saved successfully!`);
    } else if (delta.state.current === 'interrupted') {
      activeDownloads.delete(download.tweetId);
      showNotification('Download Failed', 'The download was interrupted.');
    }
  }
});

/**
 * Show notification to user
 */
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon-128.png',
    title: title,
    message: message
  });
}