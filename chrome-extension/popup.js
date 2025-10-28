// Popup UI logic for RTool Chrome Extension

const instanceCount = document.getElementById('instanceCount');
const siteUrl = document.getElementById('siteUrl');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const status = document.getElementById('status');
const transformsList = document.getElementById('transformsList');
const detachBtn = document.getElementById('detachBtn');

let activeWindows = [];
let windowTransforms = {};

// Listen for conversation logs from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addToLog') {
    console.log('[RTool Popup] Received log entry:', request);
    addLogEntry(request.windowIndex, request.prompt, request.response, request.timestamp);
    sendResponse({ success: true });
  }
});

// Check if we're already in a detached/popup window
// If so, hide the detach button since we're already floating
chrome.windows.getCurrent((currentWindow) => {
  if (currentWindow.type === 'popup') {
    // Already in a floating window, hide the detach button
    document.querySelector('.detach-bar').style.display = 'none';
  }
});

// Detach panel to separate window (resizable)
detachBtn.addEventListener('click', () => {
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 500,
    height: 700,
    top: 100,
    left: 100
    // Note: Chrome popup windows are automatically resizable by the user
    // They can drag the edges/corners to resize
  });
  window.close(); // Close the extension popup
});

// Transform options (same structure as Electron app)
const transformOptions = {
  none: [{ value: 'none', label: 'No Transform' }],
  encoding: [
    { value: 'base64', label: 'Base64' },
    { value: 'hex', label: 'Hexadecimal' },
    { value: 'binary', label: 'Binary' },
    { value: 'url', label: 'URL Encode' },
    { value: 'morse', label: 'Morse Code' }
  ],
  ciphers: [
    { value: 'rot13', label: 'ROT13' },
    { value: 'caesar3', label: 'Caesar +3' },
    { value: 'atbash', label: 'Atbash' },
    { value: 'reverse', label: 'Reverse' }
  ],
  visual: [
    { value: 'upside-down', label: 'Upside Down' },
    { value: 'strikethrough', label: 'Strikethrough' },
    { value: 'double-struck', label: 'Double-Struck' }
  ],
  formatting: [
    { value: 'small-caps', label: 'Small Caps' },
    { value: 'wide', label: 'Wide Text' },
    { value: 'circled', label: 'Circled' }
  ],
  unicode: [
    { value: 'zwsp-inject', label: 'Zero-Width Space Inject' },
    { value: 'zwj-inject', label: 'Zero-Width Joiner Inject' },
    { value: 'zwnj-inject', label: 'Zero-Width Non-Joiner Inject' },
    { value: 'combining-marks', label: 'Combining Marks' },
    { value: 'zalgo-light', label: 'Zalgo (Light)' }
  ],
  special: [
    { value: 'leet', label: 'Leet Speak' },
    { value: 'emoji-regional', label: 'Regional Indicator Emoji' }
  ],
  fantasy: [
    { value: 'fraktur', label: 'Fraktur' },
    { value: 'script', label: 'Script/Cursive' }
  ],
  ancient: [
    { value: 'runic', label: 'Runic' },
    { value: 'phoenician', label: 'Phoenician' }
  ]
};

// Initialize - wait for windows to load before enabling buttons
(async () => {
  sendBtn.disabled = true;
  await loadWindows();
  if (activeWindows.length === 0) {
    sendBtn.disabled = true;
  } else {
    sendBtn.disabled = false;
  }
  await loadLoggingConfig(); // Load saved logging configuration
})();

// CSV Logging
const enableLogging = document.getElementById('enableLogging');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const loggingStatus = document.getElementById('loggingStatus');

let sessionLogs = [];

// Load logging configuration
async function loadLoggingConfig() {
  const data = await chrome.storage.local.get(['loggingEnabled', 'sessionLogs']);
  enableLogging.checked = data.loggingEnabled || false;
  sessionLogs = data.sessionLogs || [];
  updateLoggingStatus(`${sessionLogs.length} entries logged`, 'normal');
}

// Save logging toggle
enableLogging.addEventListener('change', async () => {
  await chrome.storage.local.set({ loggingEnabled: enableLogging.checked });
  updateLoggingStatus(enableLogging.checked ? 'Logging enabled' : 'Logging disabled', 'success');
});

// Export CSV
exportCsvBtn.addEventListener('click', () => {
  if (sessionLogs.length === 0) {
    updateLoggingStatus('No logs to export', 'error');
    return;
  }
  
  // Create CSV content
  const headers = ['Timestamp', 'Window', 'Transform', 'Prompt', 'Response', 'Source'];
  const rows = sessionLogs.map(log => {
    // Format window name
    let windowName;
    if (log.windowIndex === 'Base') {
      windowName = 'Base';
    } else if (typeof log.windowIndex === 'number') {
      windowName = `Window ${log.windowIndex + 1}`;
    } else {
      windowName = log.windowIndex;
    }
    
    return [
      log.timestamp,
      windowName,
      log.transform || 'none:none',
      `"${(log.prompt || '').replace(/"/g, '""')}"`, // Escape quotes
      `"${(log.response || '(pending)').replace(/"/g, '""')}"`, // Escape quotes
      log.source || 'rtool'
    ];
  });
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  
  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rtool-log-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  updateLoggingStatus(`Exported ${sessionLogs.length} entries`, 'success');
});

// Clear logs
clearLogsBtn.addEventListener('click', async () => {
  if (confirm(`Clear ${sessionLogs.length} log entries?`)) {
    sessionLogs = [];
    await chrome.storage.local.set({ sessionLogs: [] });
    updateLoggingStatus('Logs cleared', 'success');
  }
});

// Update logging status message
function updateLoggingStatus(message, type = 'normal') {
  loggingStatus.textContent = message;
  loggingStatus.className = 'logging-status ' + type;
}

// Open windows
openBtn.addEventListener('click', async () => {
  const count = parseInt(instanceCount.value);
  const url = siteUrl.value.trim();
  
  if (!url) {
    updateStatus('Please enter a URL', 'error');
    return;
  }
  
  updateStatus('Opening windows...', 'normal');
  openBtn.disabled = true;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'openWindows',
      count: count,
      url: url
    });
    
    console.log('[RTool Popup] Open windows response:', response);
    
    if (response && response.success) {
      updateStatus(`✓ Opened ${response.count} window(s)`, 'success');
      activeWindows = response.windows;
      initializeTransforms();
      sendBtn.disabled = false; // Enable send button
      console.log('[RTool Popup] Send button enabled');
      
      // Start monitoring for manual interactions
      setTimeout(async () => {
        try {
          await chrome.runtime.sendMessage({ action: 'startMonitoring' });
          console.log('[RTool Popup] Started conversation monitoring');
        } catch (error) {
          console.error('[RTool Popup] Failed to start monitoring:', error);
        }
      }, 2000); // Wait for pages to load
    } else {
      const errorMsg = response?.error || 'Unknown error';
      updateStatus(`Error: ${errorMsg}`, 'error');
      sendBtn.disabled = true;
      console.error('[RTool Popup] Open windows failed:', errorMsg);
    }
  } catch (error) {
    updateStatus(`Error: ${error.message}`, 'error');
    sendBtn.disabled = true;
    console.error('[RTool Popup] Exception opening windows:', error);
  } finally {
    openBtn.disabled = false;
  }
});

// Close windows
closeBtn.addEventListener('click', async () => {
  updateStatus('Closing windows...', 'normal');
  closeBtn.disabled = true;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'closeWindows'
    });
    
    if (response.success) {
      updateStatus('✓ All windows closed', 'success');
      activeWindows = [];
      windowTransforms = {};
      updateTransformsList();
      sendBtn.disabled = true; // Disable send button
    } else {
      updateStatus(`Error: ${response.error}`, 'error');
    }
  } catch (error) {
    updateStatus(`Error: ${error.message}`, 'error');
  } finally {
    closeBtn.disabled = false;
  }
});

// Send prompt
sendBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  
  if (!prompt) {
    updateStatus('Please enter a prompt', 'error');
    return;
  }
  
  // Check windows without resetting state
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getWindows' });
    if (!response || !response.windows || response.windows.length === 0) {
      updateStatus('No windows open. Click "Open Windows" first.', 'error');
      return;
    }
    // Update activeWindows but DON'T reinitialize transforms
    activeWindows = response.windows;
  } catch (error) {
    updateStatus('Error checking windows', 'error');
    return;
  }
  
  updateStatus(`Sending prompt to ${activeWindows.length} window(s)...`, 'normal');
  sendBtn.disabled = true;
  
  try {
    console.log('[RTool Popup] Active windows:', activeWindows);
    console.log('[RTool Popup] Window transforms:', windowTransforms);
    console.log('[RTool Popup] Transform keys:', Object.keys(windowTransforms));
    
    const response = await chrome.runtime.sendMessage({
      action: 'sendPrompt',
      prompt: prompt,
      transforms: windowTransforms
    });
    
    console.log('[RTool Popup] Send prompt response:', response);
    
    if (response && response.success) {
      updateStatus(`✓ Sent to ${response.successCount}/${response.totalCount} window(s)`, 'success');
      
      // Log to CSV if enabled
      await logToCSV(prompt, response.results);
      
      promptInput.value = '';
    } else {
      updateStatus(`Error: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('[RTool Popup] Send prompt error:', error);
    updateStatus(`Error: ${error.message}`, 'error');
  } finally {
    sendBtn.disabled = false;
  }
});

// Log to CSV
async function logToCSV(prompt, results) {
  try {
    const data = await chrome.storage.local.get('loggingEnabled');
    if (!data.loggingEnabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    
    // Add one "Base" entry with the original prompt
    sessionLogs.push({
      timestamp: timestamp,
      windowIndex: 'Base',
      transform: 'none:none',
      prompt: prompt,
      response: '(pending)',
      success: true,
      source: 'rtool'
    });
    
    // Only add individual window entries if they have transforms applied
    for (const result of results) {
      const hasTransform = result.transform && result.transform !== 'none:none';
      
      if (hasTransform) {
        sessionLogs.push({
          timestamp: timestamp,
          windowIndex: result.index,
          transform: result.transform,
          prompt: prompt,
          response: '(pending)',
          success: result.success || false,
          source: 'rtool'
        });
      }
    }
    
    // Save to storage
    await chrome.storage.local.set({ sessionLogs: sessionLogs });
    updateLoggingStatus(`${sessionLogs.length} entries logged`, 'success');
    
    console.log('[RTool] Logged to CSV buffer');
  } catch (error) {
    console.error('[RTool] Failed to log:', error);
  }
}

// Add a log entry (from conversation monitoring or manual interaction)
async function addLogEntry(windowIndex, prompt, response, timestamp) {
  try {
    const data = await chrome.storage.local.get('loggingEnabled');
    if (!data.loggingEnabled) {
      return;
    }

    // First, try to update the Base entry (untransformed prompt)
    const basePendingIndex = sessionLogs.findIndex(
      log => log.windowIndex === 'Base' && 
             log.prompt === prompt && 
             log.response === '(pending)'
    );

    if (basePendingIndex !== -1) {
      // Update Base entry with response
      sessionLogs[basePendingIndex].response = response;
      console.log('[RTool] Updated Base log entry with response');
    } else {
      // Check if there's a pending entry for this specific window
      const windowPendingIndex = sessionLogs.findIndex(
        log => log.windowIndex === windowIndex && 
               log.prompt === prompt && 
               log.response === '(pending)'
      );

      if (windowPendingIndex !== -1) {
        // Update existing window entry with response
        sessionLogs[windowPendingIndex].response = response;
        console.log(`[RTool] Updated window ${windowIndex} log entry with response`);
      } else {
        // Add new entry (manual interaction)
        sessionLogs.push({
          timestamp: timestamp || new Date().toISOString(),
          windowIndex: windowIndex,
          transform: 'none:none', // Manual entries have no transform
          prompt: prompt,
          response: response,
          success: true,
          source: 'manual'
        });
        console.log('[RTool] Added manual interaction to log');
      }
    }
    
    // Save to storage
    await chrome.storage.local.set({ sessionLogs: sessionLogs });
    updateLoggingStatus(`${sessionLogs.length} entries logged`, 'success');
  } catch (error) {
    console.error('[RTool] Failed to add log entry:', error);
  }
}

// Load windows from background
async function loadWindows() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getWindows' });
    if (response && response.windows && response.windows.length > 0) {
      activeWindows = response.windows;
      initializeTransforms();
      updateStatus(`${activeWindows.length} window(s) active`, 'success');
      sendBtn.disabled = false;
    } else {
      activeWindows = [];
      updateStatus('Click "Open Windows" to start', 'normal');
      sendBtn.disabled = true;
    }
  } catch (error) {
    console.error('Error loading windows:', error);
    updateStatus('Ready. Open windows to begin.', 'normal');
    sendBtn.disabled = true;
  }
}

// Initialize transforms for all windows
function initializeTransforms() {
  windowTransforms = {};
  activeWindows.forEach(win => {
    windowTransforms[win.index] = {
      category: 'none',
      method: 'none'
    };
  });
  updateTransformsList();
}

// Update transforms list
function updateTransformsList() {
  if (activeWindows.length === 0) {
    transformsList.innerHTML = '<div class="empty-state">Open windows to configure transforms</div>';
    return;
  }
  
  transformsList.innerHTML = '';
  
  activeWindows.forEach(win => {
    const item = document.createElement('div');
    item.className = 'transform-item';
    
    const header = document.createElement('div');
    header.className = 'transform-header';
    header.textContent = `Window #${win.index + 1}`;
    item.appendChild(header);
    
    const controls = document.createElement('div');
    controls.className = 'transform-controls';
    
    // Category select
    const categorySelect = document.createElement('select');
    categorySelect.id = `category-${win.index}`;
    ['none', 'encoding', 'ciphers', 'visual', 'formatting', 'unicode', 'special', 'fantasy', 'ancient'].forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      categorySelect.appendChild(option);
    });
    
    // Method select
    const methodSelect = document.createElement('select');
    methodSelect.id = `method-${win.index}`;
    const noneOption = document.createElement('option');
    noneOption.value = 'none';
    noneOption.textContent = 'No Transform';
    methodSelect.appendChild(noneOption);
    
    // Category change handler
    categorySelect.addEventListener('change', () => {
      const category = categorySelect.value;
      const options = transformOptions[category] || transformOptions.none;
      
      methodSelect.innerHTML = '';
      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        methodSelect.appendChild(option);
      });
      
      windowTransforms[win.index] = {
        category: category,
        method: methodSelect.value
      };
    });
    
    // Method change handler
    methodSelect.addEventListener('change', () => {
      windowTransforms[win.index] = {
        category: categorySelect.value,
        method: methodSelect.value
      };
    });
    
    controls.appendChild(categorySelect);
    controls.appendChild(methodSelect);
    item.appendChild(controls);
    
    transformsList.appendChild(item);
  });
}

// Update status
function updateStatus(message, type = 'normal') {
  status.textContent = message;
  status.className = 'status ' + type;
}

// Enter key in prompt
promptInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) {
      sendBtn.click();
    }
  }
});

