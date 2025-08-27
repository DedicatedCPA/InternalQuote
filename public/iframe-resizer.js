// Enhanced Iframe Resizer for Quote App
// This script helps iframes automatically resize to fit their content
// Specifically designed for Wix and other website builders

(function() {
  'use strict';
  
  let resizeTimeout;
  let lastHeight = 0;
  let lastWidth = 0;
  
  // Function to send height to parent window
  function sendHeight() {
    const body = document.body;
    const html = document.documentElement;
    
    // Get the maximum height from different methods
    const height = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );
    
    const width = Math.max(
      body.scrollWidth,
      body.offsetWidth,
      html.clientWidth,
      html.scrollWidth,
      html.offsetWidth
    );
    
    // Only send if height actually changed
    if (height !== lastHeight || width !== lastWidth) {
      lastHeight = height;
      lastWidth = width;
      
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'resize',
          height: height,
          width: width,
          timestamp: Date.now()
        }, '*');
      }
    }
  }
  
  // Debounced resize function
  function debouncedResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(sendHeight, 100);
  }
  
  // Function to handle window resize
  function handleResize() {
    debouncedResize();
  }
  
  // Function to observe content changes more aggressively
  function observeContentChanges() {
    const observer = new MutationObserver(function(mutations) {
      // Check for significant changes
      let shouldResize = false;
      
      mutations.forEach(function(mutation) {
        // Resize on any DOM changes
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          shouldResize = true;
        }
        
        // Specifically watch for form changes, input changes, etc.
        if (mutation.target.tagName === 'INPUT' || 
            mutation.target.tagName === 'SELECT' || 
            mutation.target.tagName === 'TEXTAREA' ||
            mutation.target.classList.contains('dashboard-content') ||
            mutation.target.classList.contains('dashboard-tables')) {
          shouldResize = true;
        }
      });
      
      if (shouldResize) {
        debouncedResize();
      }
    });
    
    // Observe the entire document body
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'value', 'checked', 'selected'],
      characterData: true
    });
    
    // Also observe specific elements that might change
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardContent) {
      observer.observe(dashboardContent, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }
  }
  
  // Function to watch for form interactions
  function watchFormInteractions() {
    // Watch for input changes
    document.addEventListener('input', debouncedResize);
    document.addEventListener('change', debouncedResize);
    document.addEventListener('click', function(e) {
      // Resize when buttons are clicked (like add account, add payroll)
      if (e.target.tagName === 'BUTTON' || e.target.classList.contains('btn')) {
        setTimeout(debouncedResize, 200); // Small delay to let DOM update
      }
    });
    
    // Watch for focus events (form interactions)
    document.addEventListener('focus', debouncedResize, true);
    document.addEventListener('blur', debouncedResize, true);
  }
  
  // Function to watch for dynamic content loading
  function watchDynamicContent() {
    // Use Intersection Observer to watch for new content
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          debouncedResize();
        }
      });
    });
    
    // Observe all elements that might be dynamically added
    const elementsToWatch = document.querySelectorAll('.dashboard-table, .form-row, .service-item');
    elementsToWatch.forEach(function(element) {
      observer.observe(element);
    });
  }
  
  // Initialize when DOM is ready
  function initialize() {
    sendHeight();
    observeContentChanges();
    watchFormInteractions();
    watchDynamicContent();
    
    // Set up periodic checking for dynamic content
    setInterval(function() {
      const currentHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
      
      if (currentHeight !== lastHeight) {
        sendHeight();
      }
    }, 2000); // Check every 2 seconds
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // Listen for window resize events
  window.addEventListener('resize', handleResize);
  
  // Send height after various delays to catch all content
  setTimeout(sendHeight, 100);
  setTimeout(sendHeight, 500);
  setTimeout(sendHeight, 1000);
  setTimeout(sendHeight, 2000);
  
  // Listen for custom events that might be triggered by the app
  window.addEventListener('contentChanged', debouncedResize);
  window.addEventListener('formUpdated', debouncedResize);
  window.addEventListener('sectionAdded', debouncedResize);
  
  // Expose resize function globally for manual triggering
  window.triggerResize = sendHeight;
})(); 