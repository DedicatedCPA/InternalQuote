# Wix Integration Guide for Quote App

This guide provides specific solutions for integrating the Quote App with Wix websites, including automatic height adjustment when content changes dynamically.

## The Problem with Wix

Wix doesn't automatically adjust iframe heights when content changes dynamically (like adding accounts or payroll sections). This guide provides several solutions to work around this limitation.

## Solution 1: Enhanced JavaScript Integration (Recommended)

### Step 1: Add Custom HTML Element in Wix

1. In your Wix editor, add a **Custom HTML** element
2. Place it where you want the Quote App to appear
3. Use this code:

```html
<div id="quote-app-container" style="width: 100%; max-width: 1200px; margin: 0 auto;">
  <iframe 
    id="quote-app-iframe"
    src="https://your-vercel-app.vercel.app/iframe.html"
    style="width: 100%; border: none; overflow: hidden; min-height: 600px;"
    scrolling="no"
    frameborder="0"
    allowfullscreen>
  </iframe>
</div>

<script>
(function() {
  const iframe = document.getElementById('quote-app-iframe');
  let resizeTimeout;
  let lastHeight = 0;
  
  // Function to resize iframe
  function resizeIframe(height) {
    if (height && height !== lastHeight) {
      lastHeight = height;
      iframe.style.height = height + 'px';
      
      // Trigger Wix's resize event if available
      if (window.Wix && window.Wix.Utils) {
        try {
          window.Wix.Utils.resizeWindow();
        } catch (e) {
          // Wix resize not available, continue
        }
      }
    }
  }
  
  // Listen for resize messages from iframe
  window.addEventListener('message', function(event) {
    if (event.data.type === 'resize') {
      resizeIframe(event.data.height);
    }
  });
  
  // Handle iframe load
  iframe.onload = function() {
    // Request initial size
    setTimeout(function() {
      iframe.contentWindow.postMessage({type: 'getSize'}, '*');
    }, 1000);
  };
  
  // Periodic height check (backup method)
  setInterval(function() {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({type: 'getSize'}, '*');
      }
    } catch (e) {
      // Cross-origin error, ignore
    }
  }, 3000);
  
  // Manual resize trigger (for testing)
  window.manualResize = function() {
    try {
      if (iframe.contentWindow && iframe.contentWindow.triggerResize) {
        iframe.contentWindow.triggerResize();
      }
    } catch (e) {
      console.log('Manual resize failed:', e);
    }
  };
})();
</script>
```

## Solution 2: Wix Velo Integration (Advanced)

If you have Wix Velo (formerly Corvid), you can use this more advanced solution:

### Step 1: Add Custom HTML Element

```html
<div id="quote-app-container" style="width: 100%; max-width: 1200px; margin: 0 auto;">
  <iframe 
    id="quote-app-iframe"
    src="https://your-vercel-app.vercel.app/iframe.html"
    style="width: 100%; border: none; overflow: hidden; min-height: 600px;"
    scrolling="no"
    frameborder="0">
  </iframe>
</div>
```

### Step 2: Add Velo Code

In your Wix Velo code editor, add this:

```javascript
import wixWindow from 'wix-window';

$w.onReady(function () {
  const iframe = $w('#quote-app-iframe');
  let lastHeight = 0;
  
  // Listen for resize messages
  wixWindow.rendered.then(() => {
    window.addEventListener('message', function(event) {
      if (event.data.type === 'resize') {
        const newHeight = event.data.height;
        if (newHeight && newHeight !== lastHeight) {
          lastHeight = newHeight;
          
          // Resize the iframe
          iframe.style.height = newHeight + 'px';
          
          // Trigger Wix's internal resize
          wixWindow.resizeTo(newHeight + 100, wixWindow.getBoundingRect().width);
        }
      }
    });
  });
});
```

## Solution 3: CSS-Only Approach (Simplest)

For a simpler approach that works with most Wix setups:

```html
<div style="width: 100%; max-width: 1200px; margin: 0 auto; padding: 20px;">
  <iframe 
    src="https://your-vercel-app.vercel.app/iframe.html"
    style="width: 100%; height: 100vh; border: none; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"
    scrolling="no"
    frameborder="0">
  </iframe>
</div>
```

## Solution 4: Responsive Container with Manual Resize

This solution provides a responsive container with manual resize capability:

```html
<style>
.quote-app-wrapper {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
}

.quote-app-iframe {
  width: 100%;
  min-height: 600px;
  border: none;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  transition: height 0.3s ease;
}

.resize-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  margin: 10px 0;
  font-size: 14px;
}

.resize-button:hover {
  background: #0056b3;
}

@media (max-width: 768px) {
  .quote-app-wrapper {
    padding: 10px;
  }
  
  .quote-app-iframe {
    min-height: 500px;
  }
}
</style>

<div class="quote-app-wrapper">
  <button class="resize-button" onclick="manualResize()">Adjust Height</button>
  <iframe 
    id="quote-app-iframe"
    class="quote-app-iframe"
    src="https://your-vercel-app.vercel.app/iframe.html"
    scrolling="no"
    frameborder="0">
  </iframe>
</div>

<script>
(function() {
  const iframe = document.getElementById('quote-app-iframe');
  let lastHeight = 0;
  
  // Listen for resize messages
  window.addEventListener('message', function(event) {
    if (event.data.type === 'resize') {
      const newHeight = event.data.height;
      if (newHeight && newHeight !== lastHeight) {
        lastHeight = newHeight;
        iframe.style.height = newHeight + 'px';
      }
    }
  });
  
  // Manual resize function
  window.manualResize = function() {
    try {
      if (iframe.contentWindow && iframe.contentWindow.triggerResize) {
        iframe.contentWindow.triggerResize();
      } else {
        // Fallback: request size update
        iframe.contentWindow.postMessage({type: 'getSize'}, '*');
      }
    } catch (e) {
      console.log('Manual resize failed:', e);
    }
  };
  
  // Auto-resize on load
  iframe.onload = function() {
    setTimeout(window.manualResize, 1000);
  };
})();
</script>
```

## Solution 5: Wix App Integration (Professional)

For a more professional approach, you can create a Wix app:

### Step 1: Create Wix App Structure

```javascript
// In your Wix app
export function createQuoteAppWidget() {
  return {
    // Widget configuration
    config: {
      iframeUrl: 'https://your-vercel-app.vercel.app/iframe.html',
      minHeight: 600,
      maxWidth: 1200
    },
    
    // Initialize widget
    init: function() {
      this.createIframe();
      this.setupResizeListener();
    },
    
    // Create iframe element
    createIframe: function() {
      const iframe = document.createElement('iframe');
      iframe.src = this.config.iframeUrl;
      iframe.style.cssText = `
        width: 100%;
        border: none;
        overflow: hidden;
        min-height: ${this.config.minHeight}px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      `;
      iframe.scrolling = 'no';
      iframe.frameBorder = '0';
      
      this.container.appendChild(iframe);
      this.iframe = iframe;
    },
    
    // Setup resize listener
    setupResizeListener: function() {
      window.addEventListener('message', (event) => {
        if (event.data.type === 'resize') {
          this.resizeIframe(event.data.height);
        }
      });
    },
    
    // Resize iframe
    resizeIframe: function(height) {
      if (this.iframe && height) {
        this.iframe.style.height = height + 'px';
      }
    }
  };
}
```

## Testing Your Integration

### 1. Test Dynamic Content
- Add accounts/payroll sections
- Fill out forms
- Toggle different sections
- Verify iframe height adjusts

### 2. Test Responsiveness
- Test on desktop, tablet, mobile
- Verify content fits without scroll bars
- Check that height adjusts properly

### 3. Test Performance
- Monitor for any lag or delays
- Ensure smooth height transitions
- Check memory usage

## Troubleshooting

### If height doesn't adjust:
1. **Check Console**: Look for JavaScript errors
2. **Verify URL**: Ensure you're using the `/iframe.html` version
3. **Test Manual Resize**: Try the manual resize button
4. **Clear Cache**: Hard refresh the page

### If Wix blocks the iframe:
1. **Check Wix Settings**: Ensure iframes are allowed
2. **Use HTTPS**: Make sure your Vercel app uses HTTPS
3. **Contact Wix Support**: Some features may require approval

### If content is cut off:
1. **Increase Min Height**: Adjust the `min-height` CSS property
2. **Check Container**: Ensure the Wix container is large enough
3. **Test Different Sizes**: Try different container widths

## Best Practices

1. **Always use HTTPS**: Both Wix and your Vercel app should use HTTPS
2. **Test thoroughly**: Test all dynamic content scenarios
3. **Monitor performance**: Watch for any performance issues
4. **Provide fallbacks**: Always have a manual resize option
5. **Document changes**: Keep track of any customizations

## Support

If you continue to have issues:
1. Check the browser console for errors
2. Test the iframe URL directly in a new tab
3. Verify your Vercel deployment is working
4. Contact support with specific error messages

This comprehensive approach should solve the Wix iframe height adjustment issue! 