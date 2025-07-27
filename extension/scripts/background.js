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
    title: 'Download X Video',
    contexts: ['page', 'video', 'image'],
    documentUrlPatterns: ['*://twitter.com/*', '*://x.com/*']
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
  
  // Extract tweet URL
  const tweetMatch = tab.url.match(/\/status\/(\d+)/);
  if (!tweetMatch) {
    showNotification('Invalid URL', 'This doesn\'t appear to be a tweet with video.');
    return;
  }
  
  const tweetId = tweetMatch[1];
  await downloadVideo(tweetId, tab.url, quality);
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    downloadVideo(request.tweetId, request.url, request.quality)
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
 * Main download function using syndication API
 */
async function downloadVideo(tweetId, tweetUrl, quality = 'high') {
  try {
    // Check if already downloading
    if (activeDownloads.has(tweetId)) {
      showNotification('Already Downloading', 'This video is already being downloaded.');
      return { error: 'Already downloading' };
    }
    
    // Add to active downloads
    activeDownloads.set(tweetId, {
      tweetId,
      url: tweetUrl,
      status: 'fetching',
      progress: 0
    });
    
    // Fetch video URL using syndication API
    const videoUrl = await fetchVideoUrl(tweetId);
    
    if (!videoUrl) {
      activeDownloads.delete(tweetId);
      showNotification('No Video Found', 'Could not find a video in this tweet.');
      return { error: 'No video found' };
    }
    
    // Start download
    const filename = `twitter_video_${tweetId}.mp4`;
    
    chrome.downloads.download({
      url: videoUrl,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        activeDownloads.delete(tweetId);
        showNotification('Download Failed', chrome.runtime.lastError.message);
        return;
      }
      
      // Track download progress
      activeDownloads.set(tweetId, {
        tweetId,
        url: tweetUrl,
        downloadId,
        status: 'downloading',
        progress: 0
      });
      
      showNotification('Download Started', `Downloading ${filename}`);
    });
    
    return { success: true, videoUrl };
    
  } catch (error) {
    activeDownloads.delete(tweetId);
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