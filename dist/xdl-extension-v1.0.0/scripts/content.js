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

// Generate unique ID for elements
function generateElementId(element) {
  const rect = element.getBoundingClientRect();
  const path = [];
  let el = element;
  
  // Build a path from element to body
  while (el && el !== document.body) {
    let selector = el.tagName.toLowerCase();
    if (el.id) {
      selector += '#' + el.id;
    } else if (el.className && typeof el.className === 'string') {
      selector += '.' + el.className.split(' ').filter(c => c && !c.startsWith('xdl-')).slice(0, 2).join('.');
    }
    path.unshift(selector);
    el = el.parentElement;
  }
  
  // Create a unique ID based on position and DOM path
  return `xdl-${path.join('>')}-${Math.round(rect.top)}-${Math.round(rect.left)}`;
}

// Track processed elements with WeakMap for better memory management
let processedElements = new WeakMap();

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
  button.title = 'Download Video';
  button.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
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
  const actionGroups = document.querySelectorAll('[role="group"]');
  
  actionGroups.forEach(group => {
    // Check if already processed using WeakMap
    if (processedElements.has(group)) return;
    
    // Also check data attribute as backup
    const elementId = generateElementId(group);
    if (group.dataset.xdlProcessed === elementId) return;
    
    // Check if this is the main tweet actions group
    const buttons = group.querySelectorAll('[role="button"]');
    if (buttons.length >= 3) { // Like, Retweet, Share buttons
      // Check if we already added a button to this group
      if (group.querySelector('.xdl-button-wrapper')) return;
      
      // Create wrapper for our button
      const wrapper = document.createElement('div');
      wrapper.className = 'xdl-button-wrapper';
      wrapper.appendChild(createDownloadButton());
      
      // Insert after the last button
      const lastButton = buttons[buttons.length - 1];
      lastButton.parentElement.parentElement.appendChild(wrapper);
      
      // Mark as processed in multiple ways
      processedElements.set(group, true);
      group.dataset.xdlProcessed = elementId;
    }
  });
}

// Also add floating button for video overlays
function addFloatingButton() {
  if (!isVideoTweet()) return;
  
  const videoContainers = document.querySelectorAll('[data-testid="videoPlayer"]');
  
  videoContainers.forEach(container => {
    // Check if already processed
    if (processedElements.has(container)) return;
    
    // Also check if button already exists
    if (container.querySelector('.xdl-float-button')) return;
    
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
    processedElements.set(container, true);
  });
}

// Process timeline videos (in feed)
function processTimelineVideos() {
  const articles = document.querySelectorAll('article');
  
  articles.forEach(article => {
    // Check if already processed
    if (processedElements.has(article)) return;
    
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
    
    // Check if we already added a button
    if (actionGroup.querySelector('.xdl-mini-wrapper')) return;
    
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
    processedElements.set(article, true);
  });
}

// Single function to process all elements
function processPage() {
  injectDownloadButtons();
  addFloatingButton();
  processTimelineVideos();
}

// Single debounced processor
const debouncedProcess = debounce(processPage, 500);

// Single observer for all changes
let observer;
let isObserving = false;

function startObserving() {
  if (isObserving) return;
  
  observer = new MutationObserver(debouncedProcess);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  isObserving = true;
}

// Initial injection with longer delay to ensure page is loaded
setTimeout(() => {
  processPage();
  startObserving();
}, 1500);

// Handle navigation without creating additional observers
let lastUrl = location.href;
setInterval(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Clear processed elements on navigation
    processedElements = new WeakMap();
    setTimeout(processPage, 500);
  }
}, 1000);