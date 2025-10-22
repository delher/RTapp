// Background service worker for RTool Chrome Extension
// Manages windows and coordinates message passing

// Store active RTool windows
let rtoolWindows = [];
let isInitialized = false;

// Store control panel window
let controlPanelWindowId = null;

// Open floating control panel when extension icon is clicked
chrome.action.onClicked.addListener(async () => {
  // Check if control panel is already open
  if (controlPanelWindowId) {
    try {
      await chrome.windows.get(controlPanelWindowId);
      // If it exists, focus it
      await chrome.windows.update(controlPanelWindowId, { focused: true });
      console.log('Focused existing control panel');
      return;
    } catch (error) {
      // Window was closed, clear the ID
      controlPanelWindowId = null;
    }
  }

  // Create new floating control panel
  const window = await chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 500,
    height: 700,
    top: 100,
    left: 100
  });
  
  controlPanelWindowId = window.id;
  console.log('Opened floating control panel:', window.id);
});

// Clean up control panel window ID when closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === controlPanelWindowId) {
    console.log('Control panel closed');
    controlPanelWindowId = null;
  }
  
  // Also handle RTool windows
  const index = rtoolWindows.findIndex(w => w.id === windowId);
  if (index !== -1) {
    console.log(`Window ${windowId} was closed externally`);
    rtoolWindows.splice(index, 1);
    chrome.storage.local.set({ rtoolWindows: rtoolWindows });
  }
});

// Initialize/restore windows from storage
async function initializeWindows() {
  if (isInitialized) return;
  
  try {
    const data = await chrome.storage.local.get('rtoolWindows');
    if (data.rtoolWindows && data.rtoolWindows.length > 0) {
      // Verify windows still exist
      const validWindows = [];
      for (const win of data.rtoolWindows) {
        try {
          await chrome.windows.get(win.id);
          validWindows.push(win);
        } catch (error) {
          console.log(`Window ${win.id} no longer exists`);
        }
      }
      rtoolWindows = validWindows;
      await chrome.storage.local.set({ rtoolWindows: validWindows });
      console.log(`Restored ${rtoolWindows.length} windows from storage`);
    }
  } catch (error) {
    console.error('Error initializing windows:', error);
  }
  
  isInitialized = true;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  // Initialize windows from storage before processing any request
  initializeWindows().then(() => {
    if (request.action === 'openWindows') {
      handleOpenWindows(request.count, request.url).then(sendResponse);
    }
    else if (request.action === 'closeWindows') {
      handleCloseWindows().then(sendResponse);
    }
    else if (request.action === 'getWindows') {
      console.log('getWindows called, returning:', rtoolWindows.length, 'windows');
      sendResponse({ windows: rtoolWindows });
    }
    else if (request.action === 'sendPrompt') {
      handleSendPrompt(request.prompt, request.transforms).then(sendResponse);
    }
  });
  
  return true; // Will respond asynchronously
});

// Open multiple popup windows
async function handleOpenWindows(count, url) {
  try {
    // Validate URL
    const validation = validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const validUrl = validation.url;
    console.log(`Opening ${count} windows for ${validUrl}`);
    
    // Close existing windows first
    await handleCloseWindows();
    
    // Calculate window layout
    // Use conservative dimensions that work on most screens
    // Account for menubar, dock, etc. on macOS/Windows
    const safeScreenWidth = 1600;
    const safeScreenHeight = 900;
    const windowWidth = Math.floor(safeScreenWidth / Math.min(count, 4));
    const windowHeight = safeScreenHeight;
    
    // Create windows
    const createdWindows = [];
    for (let i = 0; i < count; i++) {
      const left = (i % 4) * windowWidth;
      
      try {
        const window = await chrome.windows.create({
          url: validUrl,
          type: 'popup',
          width: windowWidth,
          height: windowHeight,
          left: left,
          top: 50,
          focused: i === 0
        });
        
        createdWindows.push({
          id: window.id,
          tabId: window.tabs[0].id,
          url: validUrl,
          index: i
        });
        
        console.log(`[RTool BG] Created window ${i + 1}: ID ${window.id}, Tab ${window.tabs[0].id}`);
      } catch (windowError) {
        console.error(`[RTool BG] Failed to create window ${i + 1}:`, windowError);
        // Continue trying to create other windows
      }
    }
    
    if (createdWindows.length === 0) {
      return { success: false, error: 'Failed to create any windows. Try adjusting your screen resolution or window count.' };
    }
    
    rtoolWindows = createdWindows;
    console.log('[RTool BG] rtoolWindows array set to:', rtoolWindows);
    
    // Save to storage
    await chrome.storage.local.set({ rtoolWindows: createdWindows });
    console.log('[RTool BG] Windows saved to storage');
    
    return { success: true, count: createdWindows.length, windows: createdWindows };
  } catch (error) {
    console.error('[RTool BG] Error opening windows:', error);
    return { success: false, error: error.message };
  }
}

// Close all RTool windows
async function handleCloseWindows() {
  try {
    console.log(`Closing ${rtoolWindows.length} windows`);
    
    for (const win of rtoolWindows) {
      try {
        await chrome.windows.remove(win.id);
      } catch (error) {
        console.warn(`Failed to close window ${win.id}:`, error.message);
      }
    }
    
    rtoolWindows = [];
    await chrome.storage.local.set({ rtoolWindows: [] });
    
    return { success: true };
  } catch (error) {
    console.error('Error closing windows:', error);
    return { success: false, error: error.message };
  }
}

// Send prompt to all windows
async function handleSendPrompt(prompt, transforms) {
  try {
    console.log('[RTool BG] handleSendPrompt called');
    console.log('[RTool BG] rtoolWindows.length:', rtoolWindows.length);
    console.log('[RTool BG] rtoolWindows:', rtoolWindows);
    console.log('[RTool BG] Received transforms:', transforms);
    console.log('[RTool BG] Transform keys:', Object.keys(transforms));
    
    if (rtoolWindows.length === 0) {
      console.error('[RTool BG] No windows open in background!');
      return { success: false, error: 'No windows open' };
    }
    
    console.log(`[RTool BG] Sending prompt to ${rtoolWindows.length} windows`);
    
    const results = [];
    
    for (const win of rtoolWindows) {
      try {
        const transform = transforms[win.index] || { category: 'none', method: 'none' };
        console.log(`[RTool BG] Window ${win.index}: Looking up transforms[${win.index}] = `, transform);
        
        // Send message to content script in this tab
        const response = await chrome.tabs.sendMessage(win.tabId, {
          action: 'injectPrompt',
          prompt: prompt,
          transform: transform
        });
        
        results.push({
          windowId: win.id,
          tabId: win.tabId,
          index: win.index,
          success: response?.success || false,
          transform: `${transform.category}:${transform.method}`
        });
        
        console.log(`[RTool BG] Window ${win.index + 1} result:`, response);
      } catch (error) {
        console.error(`[RTool BG] Error sending to window ${win.index + 1}:`, error);
        results.push({
          windowId: win.id,
          tabId: win.tabId,
          index: win.index,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount > 0,
      results: results,
      successCount: successCount,
      totalCount: rtoolWindows.length
    };
  } catch (error) {
    console.error('[RTool BG] Error in handleSendPrompt:', error);
    return { success: false, error: error.message };
  }
}

// URL validation
function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    if (!['https:', 'http:'].includes(url.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }
    
    const blacklist = [
      /file:\/\//i,
      /localhost/i,
      /127\.0\.0\.1/i,
      /0\.0\.0\.0/i,
      /javascript:/i,
      /data:/i
    ];
    
    for (const pattern of blacklist) {
      if (pattern.test(urlString)) {
        return { valid: false, error: 'URL matches blacklisted pattern' };
      }
    }
    
    return { valid: true, url: url.href };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

console.log('RTool background service worker initialized');

