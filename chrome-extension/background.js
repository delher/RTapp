// Background service worker for RTool Chrome Extension
// Manages windows and coordinates message passing

// Store active RTool windows
let rtoolWindows = [];
let isInitialized = false;

// Store control panel window
let controlPanelWindowId = null;

// Track which tabs have content scripts injected
let injectedTabs = new Set();

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
    const tabId = rtoolWindows[index].tabId;
    rtoolWindows.splice(index, 1);
    // Remove from injected tabs set
    if (tabId) {
      injectedTabs.delete(tabId);
    }
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
  
  // Handle conversation logging from content scripts
  if (request.action === 'logConversation') {
    console.log('[RTool BG] Received conversation log:', request);
    // Forward to popup for CSV logging
    chrome.runtime.sendMessage({
      action: 'addToLog',
      windowIndex: request.windowIndex,
      prompt: request.prompt,
      response: request.response,
      timestamp: request.timestamp,
      // Forward disambiguation flags
      isAuto: request.isAuto,
      isManual: request.isManual
    }).catch(err => console.log('[RTool BG] Popup not open, log not forwarded'));
    sendResponse({ success: true });
    return true;
  }

  // Handle manual prompt capture from content scripts
  if (request.action === 'manualPrompt') {
    console.log('[RTool BG] Received manual prompt:', request);
    
    // Forward to popup for CSV logging
    // Forward all properties from the original request
    chrome.runtime.sendMessage({
      action: 'manualPrompt',
      windowIndex: request.windowIndex,
      prompt: request.prompt,
      isManual: request.isManual || true, // Forward the isManual flag
      timestamp: request.timestamp,
      url: request.url || '', // Forward URL if available
      source: request.source || 'content_script', // Forward source information
      manualOverride: request.manualOverride || true // Forward manual override flag
    }).catch(err => {
      console.log('[RTool BG] Popup not open, manual prompt not forwarded:', err);
      
      // Retry once after a delay
      setTimeout(() => {
        console.log('[RTool BG] Retrying manual prompt forward');
        chrome.runtime.sendMessage({
          action: 'manualPrompt',
          windowIndex: request.windowIndex,
          prompt: request.prompt,
          isManual: request.isManual || true,
          timestamp: request.timestamp,
          url: request.url || '',
          source: request.source || 'content_script',
          manualOverride: request.manualOverride || true, // Forward manual override flag
          isRetry: true
        }).catch(e => console.log('[RTool BG] Retry failed:', e));
      }, 1000);
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  // Initialize windows from storage before processing any request
  initializeWindows().then(() => {
    if (request.action === 'openWindows') {
      handleOpenWindows(request.count, request.url, request.siteKey).then(sendResponse);
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
    else if (request.action === 'startMonitoring') {
      handleStartMonitoring().then(sendResponse);
    }
    else {
      // Unknown action - send error response
      console.error('[RTool BG] Unknown action:', request.action);
      sendResponse({ success: false, error: `Unknown action: ${request.action}` });
    }
  }).catch(error => {
    console.error('[RTool BG] Error in initializeWindows:', error);
    sendResponse({ success: false, error: error.message });
  });
  
  return true; // Will respond asynchronously
});

// Start monitoring all open windows
async function handleStartMonitoring() {
  try {
    console.log('[RTool BG] Starting monitoring on all windows');
    let successCount = 0;
    
    for (const win of rtoolWindows) {
      try {
        // First, verify the content script is loaded
        try {
          await chrome.tabs.sendMessage(win.tabId, { action: 'ping' });
        } catch (pingError) {
          // Only re-inject if not already injected
          if (!injectedTabs.has(win.tabId)) {
            console.warn(`[RTool BG] Window ${win.index} not responding, injecting content script...`);
            
            // Inject content script
            await chrome.scripting.executeScript({
              target: { tabId: win.tabId },
              files: ['site-configs.js', 'content-extraction.js', 'gemini-extraction.js', 'content.js']
            });
            
            // Mark as injected
            injectedTabs.add(win.tabId);
            
            // Wait for injection to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Test again
            await chrome.tabs.sendMessage(win.tabId, { action: 'ping' });
            console.log(`[RTool BG] Window ${win.index} now responding after injection`);
          } else {
            console.warn(`[RTool BG] Window ${win.index} not responding but already marked as injected`);
          }
        }
        
        // Now start monitoring
        await chrome.tabs.sendMessage(win.tabId, {
          action: 'startMonitoring',
          windowIndex: win.index,
          siteKey: win.siteKey
        });
        
        console.log(`[RTool BG] Successfully started monitoring on window ${win.index}`);
        successCount++;
      } catch (error) {
        console.error(`[RTool BG] Failed to start monitoring on window ${win.index}:`, error);
      }
    }
    
    console.log(`[RTool BG] Started monitoring on ${successCount}/${rtoolWindows.length} windows`);
    return { success: successCount > 0, successCount, totalCount: rtoolWindows.length };
  } catch (error) {
    console.error('[RTool BG] Error starting monitoring:', error);
    return { success: false, error: error.message };
  }
}

// Wait for a tab to finish loading
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (tab.status === 'complete') {
        resolve();
      } else {
        const listener = (updatedTabId, changeInfo) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 10000);
      }
    });
  });
}

// Open multiple popup windows
async function handleOpenWindows(count, url, siteKey) {
  try {
    // Validate URL
    const validation = validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const validUrl = validation.url;
    console.log(`Opening ${count} windows for ${validUrl} (site: ${siteKey})`);
    
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
        
        const tabId = window.tabs[0].id;
        
        createdWindows.push({
          id: window.id,
          tabId: tabId,
          url: validUrl,
          siteKey: siteKey,
          index: i
        });
        
        console.log(`[RTool BG] Created window ${i + 1}: ID ${window.id}, Tab ${tabId}`);
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
    
    // Wait for all tabs to finish loading and verify content script
    console.log('[RTool BG] Waiting for tabs to load...');
    for (const win of createdWindows) {
      try {
        // Wait for tab to finish loading
        await waitForTabLoad(win.tabId);
        console.log(`[RTool BG] Tab ${win.tabId} finished loading`);
        
        // Get tab info for debugging
        const tab = await chrome.tabs.get(win.tabId);
        console.log(`[RTool BG] Tab ${win.tabId} URL: ${tab.url}`);
        
        // Check if already injected
        console.log(`[RTool BG] Checking injection status for tab ${win.tabId}...`);
        console.log(`[RTool BG] injectedTabs Set contains:`, Array.from(injectedTabs));
        console.log(`[RTool BG] Is tab ${win.tabId} in set?`, injectedTabs.has(win.tabId));

        if (injectedTabs.has(win.tabId)) {
          console.log(`[RTool BG] ⚠️ Tab ${win.tabId} already marked as injected, SKIPPING`);
        } else {
          // First, try pinging to see if manifest-injected scripts are already active
          let pingOk = false;
          try {
            const pingResponse = await chrome.tabs.sendMessage(win.tabId, { action: 'ping' });
            console.log(`[RTool BG] Ping response from tab ${win.tabId}:`, pingResponse);
            pingOk = true;
          } catch (e) {
            console.log(`[RTool BG] No response to ping on tab ${win.tabId}, will attempt manual injection`);
          }

          if (pingOk) {
            // Scripts already present via manifest; mark as injected and skip reinjection
            injectedTabs.add(win.tabId);
            console.log(`[RTool BG] ✓ Content scripts already active on tab ${win.tabId}, no manual injection needed`);
          } else {
            // Manually inject scripts if ping failed
            console.log(`[RTool BG] Proceeding with manual injection for tab ${win.tabId}...`);

            try {
              console.log(`[RTool BG] Injecting site-configs.js...`);
              await chrome.scripting.executeScript({
                target: { tabId: win.tabId },
                files: ['site-configs.js']
              });

              console.log(`[RTool BG] Injecting content-extraction.js...`);
              await chrome.scripting.executeScript({
                target: { tabId: win.tabId },
                files: ['content-extraction.js']
              });

              console.log(`[RTool BG] Injecting gemini-extraction.js...`);
              await chrome.scripting.executeScript({
                target: { tabId: win.tabId },
                files: ['gemini-extraction.js']
              });

              console.log(`[RTool BG] Injecting content.js...`);
              await chrome.scripting.executeScript({
                target: { tabId: win.tabId },
                files: ['content.js']
              });

              console.log(`[RTool BG] ✓ All scripts injected successfully into tab ${win.tabId}`);

              // Mark as injected
              injectedTabs.add(win.tabId);

              // Wait for scripts to initialize
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Test if content script is responding
              try {
                await chrome.tabs.sendMessage(win.tabId, { action: 'ping' });
                console.log(`[RTool BG] ✓ Tab ${win.tabId} content script responding`);
              } catch (pingError) {
                console.error(`[RTool BG] ✗ Tab ${win.tabId} not responding to ping after injection:`, pingError);
              }

            } catch (injectError) {
              console.error(`[RTool BG] ✗ Injection failed for tab ${win.tabId}:`, injectError);
              console.error(`[RTool BG] Error message:`, injectError.message);
              console.error(`[RTool BG] Error stack:`, injectError.stack);

              // Try to get more details about why injection failed
              try {
                const tab = await chrome.tabs.get(win.tabId);
                console.error(`[RTool BG] Tab details:`, {
                  url: tab.url,
                  status: tab.status,
                  title: tab.title
                });
              } catch (e) {
                console.error(`[RTool BG] Could not get tab details:`, e);
              }
            }
          }
        }
      } catch (error) {
        console.error(`[RTool BG] Failed to initialize tab ${win.tabId}:`, error);
      }
    }
    
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
    injectedTabs.clear(); // Clear the injection tracking
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
        
        // First verify content script is still responsive
        console.log(`[RTool BG] Testing connection to tab ${win.tabId}...`);
        try {
          const pingResponse = await chrome.tabs.sendMessage(win.tabId, { action: 'ping' });
          console.log(`[RTool BG] Tab ${win.tabId} responded to ping:`, pingResponse);
        } catch (pingError) {
          console.error(`[RTool BG] Tab ${win.tabId} not responding to ping:`, pingError);
          
          // Only inject if not already injected
          if (!injectedTabs.has(win.tabId)) {
            console.log(`[RTool BG] Attempting injection for tab ${win.tabId}...`);
            try {
              await chrome.scripting.executeScript({
                target: { tabId: win.tabId },
                files: ['site-configs.js', 'content-extraction.js', 'gemini-extraction.js', 'content.js']
              });
              injectedTabs.add(win.tabId);
              console.log(`[RTool BG] Injected content script into tab ${win.tabId}`);
              
              // Wait and test again
              await new Promise(resolve => setTimeout(resolve, 500));
              const retestPing = await chrome.tabs.sendMessage(win.tabId, { action: 'ping' });
              console.log(`[RTool BG] Tab ${win.tabId} now responding after injection:`, retestPing);
            } catch (reinjectError) {
              console.error(`[RTool BG] Failed to inject content script:`, reinjectError);
              throw new Error('Content script not available and injection failed');
            }
          } else {
            console.error(`[RTool BG] Tab ${win.tabId} already marked as injected but not responding`);
            throw new Error('Content script injected but not responding');
          }
        }
        
        // CRITICAL: Add extra delay for the last window to ensure it's fully loaded
        // The last window often takes longer to initialize
        if (win.index === rtoolWindows.length - 1) {
          console.log(`[RTool BG] Last window detected (${win.index}), adding extra 1s delay...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Now send the actual prompt
        console.log(`[RTool BG] Sending prompt to tab ${win.tabId}...`);
        const response = await chrome.tabs.sendMessage(win.tabId, {
          action: 'injectPrompt',
          prompt: prompt,
          transform: transform,
          windowIndex: win.index,
          siteKey: win.siteKey
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

