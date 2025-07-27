/**
 * Content Script
 * Injects download buttons directly into Twitter/X interface
 */

// Debounce function to prevent excessive processing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Check if we're on a tweet page
function isVideoTweet() {
  return window.location.pathname.includes('/status/') && 
         document.querySelector('video, [data-testid="videoPlayer"]');
}

// Extract tweet ID from current URL
function getCurrentTweetId() {
  const match = window.location.pathname.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

// Create download button
function createDownloadButton() {
  const button = document.createElement('button');
  button.className = 'xdl-download-button';
  button.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
    <span>Download</span>
  `;
  
  button.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const tweetId = getCurrentTweetId();
    if (!tweetId) {
      alert('Could not find tweet ID');
      return;
    }
    
    // Disable button and show loading state
    button.disabled = true;
    button.innerHTML = `
      <svg class="xdl-spinner" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2v4c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8h4c0 6.63-5.37 12-12 12S0 20.63 0 14 5.37 2 12 2z"/>
      </svg>
      <span>Downloading...</span>
    `;
    
    // Send download request to background script
    chrome.runtime.sendMessage({
      action: 'download',
      tweetId: tweetId,
      url: window.location.href,
      quality: 'high'
    }, (response) => {
      // Reset button state
      button.disabled = false;
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        <span>Download</span>
      `;
      
      if (response?.error) {
        console.error('Download error:', response.error);
      }
    });
  });
  
  return button;
}

// Inject download button into tweet actions
function injectDownloadButtons() {
  // Skip if not a video tweet
  if (!isVideoTweet()) return;
  
  // Find tweet action buttons (like, retweet, share)
  const actionGroups = document.querySelectorAll('[role="group"]:not(.xdl-processed)');
  
  actionGroups.forEach(group => {
    // Skip if already processed
    if (group.classList.contains('xdl-processed')) return;
    
    // Check if this is the main tweet actions group
    const buttons = group.querySelectorAll('[role="button"]');
    if (buttons.length >= 3) { // Like, Retweet, Share buttons
      // Create wrapper for our button
      const wrapper = document.createElement('div');
      wrapper.className = 'xdl-button-wrapper';
      wrapper.appendChild(createDownloadButton());
      
      // Insert after the last button
      const lastButton = buttons[buttons.length - 1];
      lastButton.parentElement.parentElement.appendChild(wrapper);
      
      // Mark as processed
      group.classList.add('xdl-processed');
    }
  });
}

// Also add floating button for video overlays
function addFloatingButton() {
  if (!isVideoTweet()) return;
  
  const videoContainers = document.querySelectorAll('[data-testid="videoPlayer"]:not(.xdl-has-float)');
  
  videoContainers.forEach(container => {
    const floatButton = document.createElement('button');
    floatButton.className = 'xdl-float-button';
    floatButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
    `;
    
    floatButton.title = 'Download Video';
    
    floatButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const tweetId = getCurrentTweetId();
      if (tweetId) {
        chrome.runtime.sendMessage({
          action: 'download',
          tweetId: tweetId,
          url: window.location.href,
          quality: 'high'
        });
      }
    });
    
    container.appendChild(floatButton);
    container.classList.add('xdl-has-float');
  });
}

// Process timeline videos (in feed)
function processTimelineVideos() {
  const articles = document.querySelectorAll('article:not(.xdl-timeline-processed)');
  
  articles.forEach(article => {
    const video = article.querySelector('video');
    if (!video) return;
    
    // Extract tweet link
    const tweetLink = article.querySelector('a[href*="/status/"]');
    if (!tweetLink) return;
    
    const tweetId = tweetLink.href.match(/\/status\/(\d+)/)?.[1];
    if (!tweetId) return;
    
    // Find the action group in this tweet
    const actionGroup = article.querySelector('[role="group"]');
    if (!actionGroup) return;
    
    // Create mini download button
    const miniButton = document.createElement('button');
    miniButton.className = 'xdl-mini-button';
    miniButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
    `;
    
    miniButton.title = 'Download Video';
    
    miniButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      chrome.runtime.sendMessage({
        action: 'download',
        tweetId: tweetId,
        url: tweetLink.href,
        quality: 'high'
      });
    });
    
    // Wrap and insert
    const wrapper = document.createElement('div');
    wrapper.className = 'xdl-mini-wrapper';
    wrapper.appendChild(miniButton);
    
    actionGroup.appendChild(wrapper);
    article.classList.add('xdl-timeline-processed');
  });
}

// Observer for dynamic content
const observer = new MutationObserver(debounce(() => {
  injectDownloadButtons();
  addFloatingButton();
  processTimelineVideos();
}, 250));

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial injection
setTimeout(() => {
  injectDownloadButtons();
  addFloatingButton();
  processTimelineVideos();
}, 1000);

// Re-run on navigation
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(() => {
      injectDownloadButtons();
      addFloatingButton();
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });