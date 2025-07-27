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
  
  // Check current page
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    const isTwitter = tab.url.includes('twitter.com') || tab.url.includes('x.com');
    
    if (!isTwitter) {
      currentStatus.textContent = 'Navigate to Twitter/X to download videos';
      currentStatus.className = 'status-message';
      videoList.innerHTML = '';
      return;
    }
    
    const isTweetPage = tab.url.includes('/status/');
    
    if (isTweetPage) {
      currentStatus.textContent = 'Video detected on this page';
      currentStatus.className = 'status-message success';
      
      // Extract tweet ID
      const tweetId = tab.url.match(/\/status\/(\d+)/)?.[1];
      if (tweetId) {
        urlInput.value = tab.url;
        
        // Show video info
        videoList.innerHTML = `
          <div class="video-item">
            <div class="video-info">
              <div class="video-title">Tweet Video</div>
              <div class="video-meta">ID: ${tweetId}</div>
            </div>
            <button class="download-button" data-tweet-id="${tweetId}" data-url="${tab.url}">
              Download
            </button>
          </div>
        `;
        
        // Add click handler
        const dlButton = videoList.querySelector('.download-button');
        dlButton.addEventListener('click', () => handleDownload(tweetId, tab.url));
      }
    } else {
      currentStatus.textContent = 'Browse to a tweet with video';
      currentStatus.className = 'status-message';
      videoList.innerHTML = '';
    }
  });
  
  // Quick download
  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    
    const tweetMatch = url.match(/\/status\/(\d+)/);
    if (!tweetMatch) {
      currentStatus.textContent = 'Invalid Twitter/X URL';
      currentStatus.className = 'status-message error';
      return;
    }
    
    const tweetId = tweetMatch[1];
    await handleDownload(tweetId, url);
  });
  
  // Handle download
  async function handleDownload(tweetId, url) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Downloading...';
    
    chrome.runtime.sendMessage({
      action: 'download',
      tweetId: tweetId,
      url: url,
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