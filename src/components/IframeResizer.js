import React, { useEffect, useRef } from 'react';

const IframeResizer = ({ children, onResize }) => {
  const containerRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const lastHeightRef = useRef(0);

  // Function to trigger resize
  const triggerResize = () => {
    if (containerRef.current) {
      const height = containerRef.current.scrollHeight;
      
      // Only trigger if height actually changed
      if (height !== lastHeightRef.current) {
        lastHeightRef.current = height;
        
        // Send message to parent window if in iframe
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'resize',
            height: height,
            width: containerRef.current.scrollWidth,
            timestamp: Date.now()
          }, '*');
        }
        
        // Call onResize callback if provided
        if (onResize) {
          onResize(height);
        }
        
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('contentChanged', {
          detail: { height, width: containerRef.current.scrollWidth }
        }));
      }
    }
  };

  // Debounced resize function
  const debouncedResize = () => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = setTimeout(triggerResize, 100);
  };

  useEffect(() => {
    // Initial resize
    triggerResize();
    
    // Set up mutation observer to watch for content changes
    const observer = new MutationObserver((mutations) => {
      let shouldResize = false;
      
      mutations.forEach((mutation) => {
        // Resize on any DOM changes
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          shouldResize = true;
        }
        
        // Specifically watch for form changes
        if (mutation.target.tagName === 'INPUT' || 
            mutation.target.tagName === 'SELECT' || 
            mutation.target.tagName === 'TEXTAREA') {
          shouldResize = true;
        }
      });
      
      if (shouldResize) {
        debouncedResize();
      }
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'value', 'checked', 'selected'],
        characterData: true
      });
    }
    
    // Listen for window resize
    const handleWindowResize = () => debouncedResize();
    window.addEventListener('resize', handleWindowResize);
    
    // Listen for custom events
    const handleContentChange = () => debouncedResize();
    window.addEventListener('contentChanged', handleContentChange);
    window.addEventListener('formUpdated', handleContentChange);
    window.addEventListener('sectionAdded', handleContentChange);
    
    // Periodic check for dynamic content
    const intervalId = setInterval(triggerResize, 2000);
    
    // Cleanup
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('contentChanged', handleContentChange);
      window.removeEventListener('formUpdated', handleContentChange);
      window.removeEventListener('sectionAdded', handleContentChange);
      clearInterval(intervalId);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  // Expose resize function globally for manual triggering
  useEffect(() => {
    window.triggerResize = triggerResize;
    return () => {
      delete window.triggerResize;
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {children}
    </div>
  );
};

export default IframeResizer; 