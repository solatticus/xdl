/**
 * Popup Script
 * Handles UI interactions and communication with background script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const urlInput = document.getElementById('urlInput');
  const downloadBtn = document.getElementById('downloadBtn');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const currentStatus = document.getElementById('current-status');
  const videoList = document.getElementById('video-list');
  
  // Settings elements
  const qualitySelect = document.getElementById('quality-select');
  const floatToggle = document.getElementById('float-toggle');
  const timelineToggle = document.getElementById('timeline-toggle');
  const notifToggle = document.getElementById('notif-toggle');
  
  // Load settings
  const settings = await chrome.storage.local.get({
    quality: 'high',
    showFloat: true,
    showTimeline: true,
    showNotifications: true
  });
  
  qualitySelect.value = settings.quality;
  floatToggle.checked = settings.showFloat;
  timelineToggle.checked = settings.showTimeline;
  notifToggle.checked = settings.showNotifications;
  
  // Save settings on change
  qualitySelect.addEventListener('change', () => {
    chrome.storage.local.set({ quality: qualitySelect.value });
  });
  
  floatToggle.addEventListener('change', () => {
    chrome.storage.local.set({ showFloat: floatToggle.checked });
  });
  
  timelineToggle.addEventListener('change', () => {
    chrome.storage.local.set({ showTimeline: timelineToggle.checked });
  });
  
  notifToggle.addEventListener('change', () => {
    chrome.storage.local.set({ showNotifications: notifToggle.checked });
  });
  
  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      tabContents.forEach(content => {
        if (content.id === `${targetTab}-tab`) {
          content.style.display = 'block';
        } else {
          content.style.display = 'none';
        }
      });
    });
  });
  
  // Platform detection
  function detectPlatform(url) {
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('rumble.com')) return 'rumble';
    return null;
  }
  
  // Check current page
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    const platform = detectPlatform(tab.url);
    
    if (!platform) {
      currentStatus.textContent = 'Navigate to Twitter/X, YouTube, or Rumble to download videos';
      currentStatus.className = 'status-message';
      videoList.innerHTML = '';
      return;
    }
    
    let isVideoPage = false;
    let videoId = null;
    let videoTitle = 'Video';
    
    switch (platform) {
      case 'twitter':
        isVideoPage = tab.url.includes('/status/');
        videoId = tab.url.match(/\/status\/(\d+)/)?.[1];
        videoTitle = 'Twitter/X Video';
        break;
        
      case 'youtube':
        isVideoPage = tab.url.includes('watch?v=') || tab.url.includes('youtu.be/');
        videoId = tab.url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
        videoTitle = 'YouTube Video';
        break;
        
      case 'rumble':
        isVideoPage = tab.url.includes('/v') || tab.url.includes('.html');
        videoId = tab.url.match(/\/(v[a-z0-9]+)/)?.[1] || 'rumble';
        videoTitle = 'Rumble Video';
        break;
    }
    
    if (isVideoPage && videoId) {
      currentStatus.textContent = `${videoTitle} detected on this page`;
      currentStatus.className = 'status-message success';
      urlInput.value = tab.url;
      
      // Show video info
      videoList.innerHTML = `
        <div class="video-item">
          <div class="video-info">
            <div class="video-title">${videoTitle}</div>
            <div class="video-meta">Platform: ${platform}</div>
          </div>
          <button class="download-button" data-video-id="${videoId}" data-url="${tab.url}">
            Download
          </button>
        </div>
      `;
      
      // Add click handler
      const dlButton = videoList.querySelector('.download-button');
      dlButton.addEventListener('click', () => handleDownload(videoId, tab.url));
    } else {
      currentStatus.textContent = `Browse to a ${platform} video page`;
      currentStatus.className = 'status-message';
      videoList.innerHTML = '';
    }
  });
  
  // Quick download
  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    
    const platform = detectPlatform(url);
    if (!platform) {
      currentStatus.textContent = 'Invalid URL. Supported: Twitter/X, YouTube, Rumble';
      currentStatus.className = 'status-message error';
      return;
    }
    
    // Extract video ID based on platform
    let videoId = null;
    switch (platform) {
      case 'twitter':
        videoId = url.match(/\/status\/(\d+)/)?.[1];
        break;
      case 'youtube':
        videoId = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
        break;
      case 'rumble':
        videoId = url.match(/\/(v[a-z0-9]+)/)?.[1] || 'rumble';
        break;
    }
    
    if (!videoId) {
      currentStatus.textContent = `Invalid ${platform} URL`;
      currentStatus.className = 'status-message error';
      return;
    }
    
    await handleDownload(videoId, url);
  });
  
  // Handle download
  async function handleDownload(videoId, url) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Downloading...';
    
    // For YouTube, show yt-dlp requirement
    const platform = detectPlatform(url);
    if (platform === 'youtube') {
      chrome.tabs.create({ 
        url: `https://github.com/yt-dlp/yt-dlp/releases`,
        active: false 
      });
      
      currentStatus.innerHTML = `
        <div style="text-align: left;">
          <strong>YouTube requires yt-dlp:</strong><br>
          1. Install yt-dlp (download page opened)<br>
          2. Use command line: <code>xdl "${url}"</code>
        </div>
      `;
      currentStatus.className = 'status-message';
      
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        Download
      `;
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'download',
      videoId: videoId,
      url: url,
      platform: platform,
      quality: qualitySelect.value
    }, (response) => {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        Download
      `;
      
      if (response?.error) {
        currentStatus.textContent = `Error: ${response.error}`;
        currentStatus.className = 'status-message error';
      } else {
        currentStatus.textContent = 'Download started!';
        currentStatus.className = 'status-message success';
      }
    });
  }
  
  // Help link
  document.getElementById('help-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/solatticus/xdl#readme' });
  });
});