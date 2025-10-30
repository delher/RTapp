// Popup UI logic for RTool Chrome Extension
// VERSION: 1.3.8 - Removed waitingForResponse check from manual prompt detection in content.js

console.log('[RTool Popup] Version 1.3.8 loaded');

const userId = document.getElementById('userId');
const instanceCount = document.getElementById('instanceCount');
const siteSelect = document.getElementById('siteSelect');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');
const promptInput = document.getElementById('promptInput');
const recycleBtn = document.getElementById('recycleBtn');
const sendBtn = document.getElementById('sendBtn');
const status = document.getElementById('status');
const transformsList = document.getElementById('transformsList');
const detachBtn = document.getElementById('detachBtn');

let activeWindows = [];
let windowTransforms = {};
let lastPrompt = '';

// Listen for conversation logs from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[RTool Popup] Received message:', request.action, 'from', sender);

  if (request.action === 'addToLog') {
    console.log('[RTool Popup] Processing addToLog:', {
      windowIndex: request.windowIndex,
      prompt: request.prompt ? request.prompt.substring(0, 30) : 'NULL',
      responseLength: request.response?.length,
      timestamp: request.timestamp,
      isAuto: request.isAuto,
      isManual: request.isManual
    });
    addLogEntry(request.windowIndex, request.prompt, request.response, request.timestamp, {
      isAuto: request.isAuto === true,
      isManual: request.isManual === true
    });
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'logConversation') {
    // Silently acknowledge but don't process - background.js will forward as 'addToLog'
    // This prevents duplicate logging
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'manualPrompt') {
    console.log('[RTool Popup] Processing manualPrompt:', {
      windowIndex: request.windowIndex,
      prompt: request.prompt ? request.prompt.substring(0, 30) : 'NULL',
      isManual: request.isManual,
      timestamp: request.timestamp,
      source: request.source || 'unknown',
      url: request.url || 'unknown',
      manualOverride: request.manualOverride
    });
    
    // Log the current state of the windowPromptMap for this window
    if (windowPromptMap[request.windowIndex]) {
      console.log(`[RTool Popup] Current windowPromptMap for window ${request.windowIndex}:`, 
        JSON.stringify({
          basePrompt: windowPromptMap[request.windowIndex].basePrompt?.substring(0, 30),
          isManual: windowPromptMap[request.windowIndex].isManual,
          isAutoPrompt: windowPromptMap[request.windowIndex].isAutoPrompt
        })
      );
    }
    
    // Check if we already have this prompt for this window
    const existingEntry = sessionLogs.find(log => 
      log.windowIndex === request.windowIndex && 
      log.prompt === request.prompt &&
      log.response === '(pending)'
    );
    
    if (existingEntry) {
      console.log(`[RTool Popup] Prompt already exists for window ${request.windowIndex}, skipping duplicate`);
      sendResponse({ success: true, status: 'duplicate' });
      return true;
    }
    
    // Create a new manual entry with pending response
    // Pass all available information to ensure proper logging
    addManualPromptEntry(
      request.windowIndex, 
      request.prompt, 
      request.timestamp, 
      request.isManual,
      request.url || '',
      request.source || ''
    );
    sendResponse({ success: true });
    return true;
  } else {
    // Ignore unknown actions instead of sending error
    // This prevents issues when messages are broadcast or sent to wrong recipients
    console.log('[RTool Popup] Ignoring unknown action:', request.action);
    return false; // Don't keep the message channel open
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

// Recycle last prompt
recycleBtn.addEventListener('click', () => {
  if (lastPrompt) {
    promptInput.value = lastPrompt;
    updateStatus('♻️ Reloaded last prompt', 'success');
  } else {
    updateStatus('No previous prompt to recycle', 'error');
  }
});

// Save userId when it changes
userId.addEventListener('change', saveUserSettings);

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
  await loadUserSettings(); // Load saved user settings
})();

// Load user settings
async function loadUserSettings() {
  const data = await chrome.storage.local.get(['userId', 'lastPrompt']);
  if (data.userId) {
    userId.value = data.userId;
  }
  if (data.lastPrompt) {
    lastPrompt = data.lastPrompt;
  }
}

// Save user settings
async function saveUserSettings() {
  await chrome.storage.local.set({
    userId: userId.value.trim(),
    lastPrompt: lastPrompt
  });
}

// CSV Logging
const enableLogging = document.getElementById('enableLogging');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const loggingStatus = document.getElementById('loggingStatus');

// ============================================================================
// CSV LOGGING SYSTEM
// ============================================================================
// ARCHITECTURE NOTES:
// The logging system is SITE-INDEPENDENT and works the same way for all AI platforms.
// It tracks:
//   1. Auto-prompts sent via "Send to All Windows" button
//   2. Manual prompts entered directly by the user
//   3. Responses from the AI
//
// The logging system uses:
//   - sessionLogs: Array of all log entries
//   - windowPromptMap: Tracks the latest prompt for each window
//   - responseId: Unique ID to match responses to prompts
//
// Site-specific extraction (content-extraction.js) provides the raw messages,
// but the logging logic here is responsible for:
//   - Associating responses with the correct prompts
//   - Distinguishing between auto and manual prompts
//   - Handling transforms for auto prompts
//   - Exporting to CSV format
//
// Changes to site-specific extraction should NOT require changes to this logging code.
// ============================================================================

let sessionLogs = [];
let nextResponseId = 1; // Counter for unique response IDs
let windowPromptMap = {}; // Map to track the latest prompt for each window

// Diagnostic function to check current state
function logDiagnostics() {
  console.log('=== RTool Diagnostics ===');
  console.log(`Total log entries: ${sessionLogs.length}`);
  console.log(`Pending entries: ${sessionLogs.filter(log => log.response === '(pending)').length}`);
  console.log(`Completed entries: ${sessionLogs.filter(log => log.response !== '(pending)').length}`);
  console.log('Entries by window:');
  for (let i = 0; i < 10; i++) {
    const windowLogs = sessionLogs.filter(log => log.windowIndex === i);
    if (windowLogs.length > 0) {
      const pending = windowLogs.filter(log => log.response === '(pending)').length;
      const completed = windowLogs.filter(log => log.response !== '(pending)').length;
      console.log(`  Window ${i}: ${windowLogs.length} total (${completed} completed, ${pending} pending)`);
      windowLogs.forEach((log, idx) => {
        console.log(`    [${idx}] ${log.basePrompt?.substring(0, 20)} | ${log.response === '(pending)' ? 'PENDING' : 'completed'}`);
      });
    }
  }
  console.log('Window Prompt Map:');
  Object.keys(windowPromptMap).forEach(idx => {
    const info = windowPromptMap[idx];
    console.log(`  Window ${idx}:`, {
      basePrompt: info.basePrompt?.substring(0, 30),
      isManual: info.isManual,
      isAutoPrompt: info.isAutoPrompt,
      responseId: info.responseId
    });
  });
  console.log('========================');
}

// Make it available globally for debugging
window.rtoolDiagnostics = logDiagnostics;

// Load logging configuration
async function loadLoggingConfig() {
  const data = await chrome.storage.local.get(['loggingEnabled', 'sessionLogs']);
  // Default to enabled if not explicitly set
  enableLogging.checked = data.loggingEnabled !== undefined ? data.loggingEnabled : true;
  sessionLogs = data.sessionLogs || [];
  updateLoggingStatus(`${sessionLogs.length} entries logged`);
  
  // Save default enabled state if first time
  if (data.loggingEnabled === undefined) {
    await chrome.storage.local.set({ loggingEnabled: true });
  }
}

// Save logging toggle
enableLogging.addEventListener('change', async () => {
  await chrome.storage.local.set({ loggingEnabled: enableLogging.checked });
  updateLoggingStatus(`${sessionLogs.length} entries logged`);
});

// Export CSV
exportCsvBtn.addEventListener('click', () => {
  if (sessionLogs.length === 0) {
    updateLoggingStatus('No logs to export');
    return;
  }
  
  // Filter out entries with "(pending)" responses
  const completedLogs = sessionLogs.filter(log => log.response !== '(pending)');
  const skippedPendingCount = sessionLogs.length - completedLogs.length;
  
  if (completedLogs.length === 0) {
    updateLoggingStatus('No completed logs to export (all are pending)');
    return;
  }
  
  if (skippedPendingCount > 0) {
    console.log(`[RTool] Skipping ${skippedPendingCount} pending entries during CSV export`);
    console.log(`[RTool] Pending entries:`, sessionLogs.filter(log => log.response === '(pending)').map(log => ({
      window: log.windowIndex,
      basePrompt: log.basePrompt,
      prompt: log.prompt ? log.prompt.substring(0, 30) : 'NULL'
    })));
  }
  
  // Create CSV content
  const headers = ['Timestamp', 'User ID', 'URL', 'Window', 'Base Prompt', 'Transform', 'Prompt', 'Response'];
  const rows = completedLogs.map(log => {
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
      log.userId || '',
      log.url || '',
      windowName,
      `"${(log.basePrompt || '').replace(/"/g, '""')}"`, // Base prompt (untransformed)
      log.transform || 'none:none',
      `"${(log.prompt || '').replace(/"/g, '""')}"`, // Transformed prompt
      `"${(log.response || '').replace(/"/g, '""')}"` // Response (never pending)
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
  
  const pendingCount = sessionLogs.length - completedLogs.length;
  if (pendingCount > 0) {
    updateLoggingStatus(`Exported ${completedLogs.length} completed entries (${pendingCount} pending entries skipped)`);
  } else {
    updateLoggingStatus(`Exported ${completedLogs.length} log entries`);
  }
});

// Clear logs
clearLogsBtn.addEventListener('click', async () => {
  if (confirm(`Clear ${sessionLogs.length} log entries?`)) {
    console.log(`[RTool] Clearing ${sessionLogs.length} log entries...`);
    
    // Clear all logs and tracking variables
    sessionLogs = [];
    windowPromptMap = {};
    nextResponseId = 1;
    
    await chrome.storage.local.set({ 
      sessionLogs: [],
      windowPromptMap: {} // Also clear stored window prompt map
    });
    // Reload to ensure we're in sync
    await loadLoggingConfig();
    console.log(`[RTool] Logs cleared, now have ${sessionLogs.length} entries`);
  }
});

// Add toggle for "Clear logs on startup" option
const clearOnStartupToggle = document.createElement('div');
clearOnStartupToggle.className = 'logging-option';
clearOnStartupToggle.innerHTML = `
  <label>
    <input type="checkbox" id="clearLogsOnStartup" checked>
    Clear logs on startup
  </label>
`;
loggingStatus.parentNode.insertBefore(clearOnStartupToggle, loggingStatus);

// Initialize and handle the toggle
const clearLogsOnStartupCheckbox = document.getElementById('clearLogsOnStartup');
chrome.storage.local.get('clearLogsOnStartup', (data) => {
  clearLogsOnStartupCheckbox.checked = data.clearLogsOnStartup !== false;
});

clearLogsOnStartupCheckbox.addEventListener('change', async () => {
  await chrome.storage.local.set({ clearLogsOnStartup: clearLogsOnStartupCheckbox.checked });
  console.log(`[RTool] Clear logs on startup set to: ${clearLogsOnStartupCheckbox.checked}`);
});

// Update logging status message
function updateLoggingStatus(message) {
  loggingStatus.textContent = message;
}

// Open windows
openBtn.addEventListener('click', async () => {
  const count = parseInt(instanceCount.value);
  const siteKey = siteSelect.value;
  const siteConfig = getSiteConfig(siteKey);
  
  if (!siteConfig) {
    updateStatus('Invalid site selection', 'error');
    return;
  }
  
  const url = siteConfig.url;
  
  updateStatus(`Opening ${siteConfig.name} windows...`, 'normal');
  openBtn.disabled = true;
  
  try {
    console.log('[RTool Popup] Sending openWindows message with:', { count, url, siteKey });
    
    const response = await chrome.runtime.sendMessage({
      action: 'openWindows',
      count: count,
      url: url,
      siteKey: siteKey  // Pass site key for content script config
    });
    
    console.log('[RTool Popup] Open windows response:', JSON.stringify(response, null, 2));
    
    if (response && response.success) {
      updateStatus(`✓ Opened ${response.count} window(s)`, 'success');
      activeWindows = response.windows;
      initializeTransforms();
      sendBtn.disabled = false; // Enable send button
      console.log('[RTool Popup] Send button enabled');
      
      // Collapse the setup section after opening windows
      const setupSection = document.getElementById('setupSection');
      if (setupSection) {
        setupSection.open = false;
        console.log('[RTool Popup] Setup section collapsed');
      }
      
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
      console.error('[RTool Popup] Open windows failed. Full response:', response);
      console.error('[RTool Popup] Error message:', errorMsg);
      console.error('[RTool Popup] Error type:', typeof errorMsg);
      updateStatus(`Error: ${errorMsg}`, 'error');
      sendBtn.disabled = true;
    }
  } catch (error) {
    console.error('[RTool Popup] Exception opening windows. Error object:', error);
    console.error('[RTool Popup] Error message:', error.message);
    console.error('[RTool Popup] Error stack:', error.stack);
    updateStatus(`Error: ${error.message}`, 'error');
    sendBtn.disabled = true;
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
      
      // Reopen the setup section when windows are closed
      const setupSection = document.getElementById('setupSection');
      if (setupSection) {
        setupSection.open = true;
        console.log('[RTool Popup] Setup section reopened');
      }
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
  const userIdValue = userId.value.trim();
  const prompt = promptInput.value.trim();
  
  if (!userIdValue) {
    updateStatus('Please enter a User ID', 'error');
    userId.focus();
    return;
  }
  
  if (!prompt) {
    updateStatus('Please enter a prompt', 'error');
    return;
  }
  
  // Save prompt for recycle feature
  lastPrompt = prompt;
  await saveUserSettings();
  
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

// Apply transform to text (duplicate of content.js transforms for logging)
function applyTransformForLog(text, transform) {
  if (!transform || transform.category === 'none' || transform.method === 'none') {
    return text;
  }
  
  const transforms = {
    encoding: {
      'base64': (text) => btoa(unescape(encodeURIComponent(text))),
      'hex': (text) => Array.from(text).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
      'binary': (text) => Array.from(text).map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '),
      'url': (text) => encodeURIComponent(text),
      'morse': (text) => {
        const morse = {'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....','I':'..','J':'.---','K':'-.-','L':'.-..','M':'--','N':'-.','O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-','U':'..-','V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.', ' ':'/'};
        return text.toUpperCase().split('').map(c => morse[c] || c).join(' ');
      }
    },
    ciphers: {
      'rot13': (text) => text.replace(/[a-zA-Z]/g, c => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26)),
      'caesar3': (text) => text.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c <= 'Z' ? (c.charCodeAt(0) + 3 > 90 ? 3 - 26 : 3) : (c.charCodeAt(0) + 3 > 122 ? 3 - 26 : 3)))),
      'atbash': (text) => text.replace(/[a-zA-Z]/g, c => String.fromCharCode((c <= 'Z' ? 90 : 122) - (c.charCodeAt(0) - (c <= 'Z' ? 65 : 97)))),
      'reverse': (text) => text.split('').reverse().join('')
    },
    visual: {
      'upside-down': (text) => {
        const map = {'a':'ɐ','b':'q','c':'ɔ','d':'p','e':'ǝ','f':'ɟ','g':'ƃ','h':'ɥ','i':'ᴉ','j':'ɾ','k':'ʞ','l':'l','m':'ɯ','n':'u','o':'o','p':'d','q':'b','r':'ɹ','s':'s','t':'ʇ','u':'n','v':'ʌ','w':'ʍ','x':'x','y':'ʎ','z':'z','A':'∀','B':'q','C':'Ɔ','D':'p','E':'Ǝ','F':'Ⅎ','G':'פ','H':'H','I':'I','J':'ſ','K':'ʞ','L':'˥','M':'W','N':'N','O':'O','P':'Ԁ','Q':'Q','R':'ɹ','S':'S','T':'┴','U':'∩','V':'Λ','W':'M','X':'X','Y':'⅄','Z':'Z'};
        return text.split('').reverse().map(c => map[c] || c).join('');
      },
      'strikethrough': (text) => text.split('').map(c => c + '\u0336').join(''),
      'double-struck': (text) => {
        const map = {'A':'𝔸','B':'𝔹','C':'ℂ','D':'𝔻','E':'𝔼','F':'𝔽','G':'𝔾','H':'ℍ','I':'𝕀','J':'𝕁','K':'𝕂','L':'𝕃','M':'𝕄','N':'ℕ','O':'𝕆','P':'ℙ','Q':'ℚ','R':'ℝ','S':'𝕊','T':'𝕋','U':'𝕌','V':'𝕍','W':'𝕎','X':'𝕏','Y':'𝕐','Z':'ℤ','a':'𝕒','b':'𝕓','c':'𝕔','d':'𝕕','e':'𝕖','f':'𝕗','g':'𝕘','h':'𝕙','i':'𝕚','j':'𝕛','k':'𝕜','l':'𝕝','m':'𝕞','n':'𝕟','o':'𝕠','p':'𝕡','q':'𝕢','r':'𝕣','s':'𝕤','t':'𝕥','u':'𝕦','v':'𝕧','w':'𝕨','x':'𝕩','y':'𝕪','z':'𝕫'};
        return text.split('').map(c => map[c] || c).join('');
      }
    },
    formatting: {
      'small-caps': (text) => {
        const map = {'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ғ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'};
        return text.split('').map(c => map[c.toLowerCase()] || c).join('');
      },
      'wide': (text) => text.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 33 && code <= 126) return String.fromCharCode(code + 65248);
        return c;
      }).join(''),
      'circled': (text) => {
        const map = {'0':'⓪','1':'①','2':'②','3':'③','4':'④','5':'⑤','6':'⑥','7':'⑦','8':'⑧','9':'⑨','A':'Ⓐ','B':'Ⓑ','C':'Ⓒ','D':'Ⓓ','E':'Ⓔ','F':'Ⓕ','G':'Ⓖ','H':'Ⓗ','I':'Ⓘ','J':'Ⓙ','K':'Ⓚ','L':'Ⓛ','M':'Ⓜ','N':'Ⓝ','O':'Ⓞ','P':'Ⓟ','Q':'Ⓠ','R':'Ⓡ','S':'Ⓢ','T':'Ⓣ','U':'Ⓤ','V':'Ⓥ','W':'Ⓦ','X':'Ⓧ','Y':'Ⓨ','Z':'Ⓩ','a':'ⓐ','b':'ⓑ','c':'ⓒ','d':'ⓓ','e':'ⓔ','f':'ⓕ','g':'ⓖ','h':'ⓗ','i':'ⓘ','j':'ⓙ','k':'ⓚ','l':'ⓛ','m':'ⓜ','n':'ⓝ','o':'ⓞ','p':'ⓟ','q':'ⓠ','r':'ⓡ','s':'ⓢ','t':'ⓣ','u':'ⓤ','v':'ⓥ','w':'ⓦ','x':'ⓧ','y':'ⓨ','z':'ⓩ'};
        return text.split('').map(c => map[c] || c).join('');
      }
    },
    unicode: {
      'zwsp-inject': (text) => text.split('').join('\u200B'),
      'zwj-inject': (text) => text.split('').join('\u200D'),
      'zwnj-inject': (text) => text.split('').join('\u200C'),
      'combining-marks': (text) => text.split('').map(c => c + '\u0301\u0308').join(''),
      'zalgo-light': (text) => {
        const marks = ['\u0300','\u0301','\u0302','\u0303','\u0304','\u0308'];
        return text.split('').map(c => c + marks[Math.floor(Math.random() * marks.length)]).join('');
      }
    },
    special: {
      'leet': (text) => {
        const map = {'a':'4','e':'3','i':'1','o':'0','s':'5','t':'7','A':'4','E':'3','I':'1','O':'0','S':'5','T':'7'};
        return text.split('').map(c => map[c] || c).join('');
      },
      'emoji-regional': (text) => {
        return text.toLowerCase().split('').map(c => {
          const code = c.charCodeAt(0);
          if (code >= 97 && code <= 122) {
            return String.fromCodePoint(0x1F1E6 + (code - 97));
          }
          return c;
        }).join('');
      }
    },
    fantasy: {
      'fraktur': (text) => {
        const map = {'A':'𝔄','B':'𝔅','C':'ℭ','D':'𝔇','E':'𝔈','F':'𝔉','G':'𝔊','H':'ℌ','I':'ℑ','J':'𝔍','K':'𝔎','L':'𝔏','M':'𝔐','N':'𝔑','O':'𝔒','P':'𝔓','Q':'𝔔','R':'ℜ','S':'𝔖','T':'𝔗','U':'𝔘','V':'𝔙','W':'𝔚','X':'𝔛','Y':'𝔜','Z':'ℨ','a':'𝔞','b':'𝔟','c':'𝔠','d':'𝔡','e':'𝔢','f':'𝔣','g':'𝔤','h':'𝔥','i':'𝔦','j':'𝔧','k':'𝔨','l':'𝔩','m':'𝔪','n':'𝔫','o':'𝔬','p':'𝔭','q':'𝔮','r':'𝔯','s':'𝔰','t':'𝔱','u':'𝔲','v':'𝔳','w':'𝔴','x':'𝔵','y':'𝔶','z':'𝔷'};
        return text.split('').map(c => map[c] || c).join('');
      },
      'script': (text) => {
        const map = {'A':'𝒜','B':'ℬ','C':'𝒞','D':'𝒟','E':'ℰ','F':'ℱ','G':'𝒢','H':'ℋ','I':'ℐ','J':'𝒥','K':'𝒦','L':'ℒ','M':'ℳ','N':'𝒩','O':'𝒪','P':'𝒫','Q':'𝒬','R':'ℛ','S':'𝒮','T':'𝒯','U':'𝒰','V':'𝒱','W':'𝒲','X':'𝒳','Y':'𝒴','Z':'𝒵','a':'𝒶','b':'𝒷','c':'𝒸','d':'𝒹','e':'ℯ','f':'𝒻','g':'ℊ','h':'𝒽','i':'𝒾','j':'𝒿','k':'𝓀','l':'𝓁','m':'𝓂','n':'𝓃','o':'ℴ','p':'𝓅','q':'𝓆','r':'𝓇','s':'𝓈','t':'𝓉','u':'𝓊','v':'𝓋','w':'𝓌','x':'𝓍','y':'𝓎','z':'𝓏'};
        return text.split('').map(c => map[c] || c).join('');
      }
    },
    ancient: {
      'runic': (text) => {
        const map = {'a':'ᚨ','b':'ᛒ','c':'ᚲ','d':'ᛞ','e':'ᛖ','f':'ᚠ','g':'ᚷ','h':'ᚺ','i':'ᛁ','j':'ᛃ','k':'ᚲ','l':'ᛚ','m':'ᛗ','n':'ᚾ','o':'ᛟ','p':'ᛈ','q':'ᚲ','r':'ᚱ','s':'ᛋ','t':'ᛏ','u':'ᚢ','v':'ᚡ','w':'ᚹ','x':'ᛪ','y':'ᛃ','z':'ᛉ'};
        return text.toLowerCase().split('').map(c => map[c] || c).join('');
      },
      'phoenician': (text) => {
        const map = {'a':'𐤀','b':'𐤁','c':'𐤂','d':'𐤃','e':'𐤄','f':'𐤅','g':'𐤂','h':'𐤇','i':'𐤉','j':'𐤉','k':'𐤊','l':'𐤋','m':'𐤌','n':'𐤍','o':'𐤏','p':'𐤐','q':'𐤒','r':'𐤓','s':'𐤔','t':'𐤕','u':'𐤅','v':'𐤅','w':'𐤅','x':'𐤎','y':'𐤉','z':'𐤆'};
        return text.toLowerCase().split('').map(c => map[c] || c).join('');
      }
    }
  };
  
  const category = transform.category;
  const method = transform.method;
  
  if (transforms[category] && transforms[category][method]) {
    try {
      return transforms[category][method](text);
    } catch (error) {
      console.error(`[RTool] Transform error (${category}:${method}):`, error);
      return text;
    }
  }
  
  return text;
}

// Log to CSV
async function logToCSV(prompt, results) {
  try {
    const data = await chrome.storage.local.get('loggingEnabled');
    if (!data.loggingEnabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    const userIdValue = userId.value.trim();
    
    // Get current site URL
    const siteKey = siteSelect.value;
    const siteConfig = getSiteConfig(siteKey);
    const siteUrl = siteConfig ? siteConfig.url.replace('https://', '').replace(/\/$/, '') : '';
    
    // First, clear any existing pending entries for these windows
    // This ensures we don't have multiple pending entries per window
    const windowIndices = results.map(r => r.index);
    
    // Remove any existing pending entries for these windows
    const existingPendingEntries = sessionLogs.filter(
      log => log.response === '(pending)' && windowIndices.includes(log.windowIndex)
    );
    
    if (existingPendingEntries.length > 0) {
      console.log(`[RTool] Removing ${existingPendingEntries.length} existing pending entries for these windows`);
      
      // Remove each pending entry
      for (const entry of existingPendingEntries) {
        const index = sessionLogs.indexOf(entry);
        if (index !== -1) {
          sessionLogs.splice(index, 1);
        }
      }
    }
    
    // First, create a shared auto prompt ID to link all windows receiving this prompt
    const sharedAutoPromptId = `auto_batch_${nextResponseId++}`;
    console.log(`[RTool] Creating auto prompt batch with ID: ${sharedAutoPromptId}`);
    
    // Create a log of which windows are receiving this auto prompt
    console.log(`[RTool] Auto prompt sent to windows: ${results.map(r => r.index).join(', ')}`);
    
    // Add entry for each window with base prompt and transformed prompt
    for (const result of results) {
      // Parse the transform
      const transformParts = (result.transform || 'none:none').split(':');
      const transformObj = {
        category: transformParts[0],
        method: transformParts[1]
      };
      
      // Apply transform to get the actual sent prompt
      const transformedPrompt = applyTransformForLog(prompt, transformObj);
      
      // Generate a unique response ID for this entry
      // Make sure it's unique for each window
      const responseId = `auto_${result.index}_${nextResponseId++}`;
      
      // Store this prompt as the latest for this window
      // AND store it in a global auto prompt map that all windows can access
      const autoPromptInfo = {
        basePrompt: prompt, // Always store the original prompt as base prompt
        transformedPrompt: transformedPrompt,
        transform: result.transform || 'none:none',
        isManual: false,
        isAutoPrompt: true, // Explicitly mark as auto prompt
        responseId: responseId,
        sharedAutoPromptId: sharedAutoPromptId, // Link to the batch
        timestamp: timestamp
      };
      
      // Ensure we're not accidentally setting this as a manual prompt
      // This is critical for auto prompts with no transform
      if (transformObj.category === 'none' && transformObj.method === 'none') {
        console.log(`[RTool] Auto prompt with no transform for window ${result.index}, ensuring it's marked as auto`);
        autoPromptInfo.isAutoPrompt = true;
        autoPromptInfo.isManual = false;
        autoPromptInfo.manualOverride = false;
      }
      
      console.log(`[RTool] Setting auto prompt info for window ${result.index}:`, 
        JSON.stringify({
          basePrompt: prompt.substring(0, 30),
          transform: result.transform || 'none:none',
          isAutoPrompt: true,
          windowIndex: result.index
        })
      );
      
      // Store in window-specific map
      windowPromptMap[result.index] = autoPromptInfo;
      
      // Create a unique entry for each window
      const autoEntry = {
        timestamp: timestamp,
        userId: userIdValue,
        url: siteUrl,
        windowIndex: result.index,
        basePrompt: prompt, // Original untransformed prompt
        transform: result.transform || 'none:none',
        prompt: transformedPrompt, // Transformed prompt
        response: '(pending)',
        responseId: responseId, // Unique ID to match responses
        sharedAutoPromptId: sharedAutoPromptId, // Link to other windows with same prompt
        isManual: false, // Flag as auto-sent prompt
        isAutoPrompt: true, // Explicitly mark as auto prompt
        success: result.success || false
      };
      
      // Double check that we're not accidentally setting this as a manual prompt
      if (transformObj.category === 'none' && transformObj.method === 'none') {
        console.log(`[RTool] Ensuring auto prompt with no transform for window ${result.index} is properly labeled`);
        // For auto prompts with no transform, make sure they're still marked as auto
        autoEntry.basePrompt = prompt; // Use the actual prompt text
        autoEntry.isAutoPrompt = true;
        autoEntry.isManual = false;
        autoEntry.manualOverride = false;
      }
      
      sessionLogs.push(autoEntry);
      
      console.log(`[RTool] Created new pending entry for window ${result.index} with transform ${result.transform}, responseId: ${responseId}, sharedAutoPromptId: ${sharedAutoPromptId}`);
    }
    
    // Store the shared auto prompt info in storage for persistence
    // Include transform information for each window
    const autoPromptData = {
      sharedAutoPromptId: sharedAutoPromptId,
      basePrompt: prompt,
      timestamp: timestamp,
      windowIndices: results.map(r => r.index),
      // Store transforms for each window
      windowTransforms: results.reduce((acc, result) => {
        acc[result.index] = result.transform || 'none:none';
        return acc;
      }, {})
    };
    
    console.log(`[RTool] Auto prompt data for sharing: ${JSON.stringify(autoPromptData)}`);
    
    // Also store this information directly in each window's prompt map
    // This ensures the transform information is available even if the auto prompt batch is lost
    results.forEach(result => {
      const transformParts = (result.transform || 'none:none').split(':');
      windowPromptMap[result.index] = {
        ...windowPromptMap[result.index],
        basePrompt: prompt, // Ensure base prompt is stored for each window
        transform: result.transform || 'none:none',
        sharedAutoPromptId: sharedAutoPromptId,
        isAutoPrompt: true
      };
    });
    
    // Get existing auto prompts or initialize empty array
    chrome.storage.local.get('autoPrompts', (data) => {
      const autoPrompts = data.autoPrompts || [];
      autoPrompts.push(autoPromptData);
      // Keep only the last 10 auto prompts
      if (autoPrompts.length > 10) {
        autoPrompts.shift();
      }
      chrome.storage.local.set({ autoPrompts: autoPrompts });
    });
    
    // Save to storage - make sure to save both sessionLogs and windowPromptMap
    await chrome.storage.local.set({ 
      sessionLogs: sessionLogs,
      windowPromptMap: windowPromptMap
    });
    updateLoggingStatus(`${sessionLogs.length} entries logged`);
    
    // Double-check that all windows have their auto prompt info
    for (const result of results) {
      console.log(`[RTool] Window ${result.index} auto prompt info:`, windowPromptMap[result.index]);
    }
    
    console.log('[RTool] Logged to CSV buffer');
  } catch (error) {
    console.error('[RTool] Failed to log:', error);
  }
}

// Add a manual prompt entry (from input monitoring)
async function addManualPromptEntry(windowIndex, prompt, timestamp, isManual = true, url = '', source = '') {
  try {
    const data = await chrome.storage.local.get('loggingEnabled');
    if (!data.loggingEnabled) {
      return;
    }

    console.log(`[RTool] ========================================`);
    console.log(`[RTool] addManualPromptEntry called: window=${windowIndex}, prompt=${prompt ? prompt.substring(0, 30) : 'NULL'}, source=${source}`);
    console.log(`[RTool] Current windowPromptMap[${windowIndex}]:`, windowPromptMap[windowIndex] ? JSON.stringify(windowPromptMap[windowIndex]) : 'NULL');
    console.log(`[RTool] Current pending entries for window ${windowIndex}:`, sessionLogs.filter(log => log.windowIndex === windowIndex && log.response === '(pending)').length);
    console.log(`[RTool] ========================================`);

    // Critical check - ensure windowIndex is valid
    if (windowIndex === null || windowIndex === undefined) {
      console.error('[RTool] Invalid window index in addManualPromptEntry');
      windowIndex = 0; // Default to window 0 as fallback
    }

    // First, check if we already have a pending entry for this window
    const existingPendingEntries = sessionLogs.filter(
      log => log.response === '(pending)' && log.windowIndex === windowIndex
    );

    // If we have pending entries for this window, only remove duplicates for the same prompt.
    if (existingPendingEntries.length > 0) {
      console.log(`[RTool] [Window ${windowIndex}] Found ${existingPendingEntries.length} existing pending entries`);
      
      // Check if any of these are for the same prompt (duplicate)
      const duplicatePendingEntry = existingPendingEntries.find(entry => 
        entry.prompt === prompt || entry.basePrompt === prompt
      );
      
      if (duplicatePendingEntry) {
        console.log(`[RTool] [Window ${windowIndex}] Found duplicate pending entry, skipping new entry creation`);
        return; // Don't create a duplicate
      }
      // Do NOT clear other pending entries (e.g., auto prompts). They will be matched by type.
    }

    // Also check if we already have this exact prompt for this window
    let duplicatePrompt = sessionLogs.some(
      log => log.windowIndex === windowIndex && 
             (log.basePrompt === prompt || log.prompt === prompt) &&
             log.response !== '(pending)'
    );

    if (duplicatePrompt) {
      console.log(`[RTool] Duplicate prompt detected for window ${windowIndex}, not adding new entry`);
      return;
    }

    // Get current site URL
    const siteKey = siteSelect.value;
    const siteConfig = getSiteConfig(siteKey);
    const siteUrl = siteConfig ? siteConfig.url.replace('https://', '').replace(/\/$/, '') : '';

    // Generate a unique response ID for this manual entry
    const responseId = `manual_${windowIndex}_${nextResponseId++}`;
    
    // Store this as the latest prompt for this window
    // Explicitly mark it as manual and NOT auto prompt
    // IMPORTANT: Clear any previous auto prompt information for this window
    
    // CRITICAL: Completely clear any auto-prompt state for this window
    console.log(`[RTool] [Window ${windowIndex}] CLEARING ALL AUTO-PROMPT STATE`);
    
    // Step 1: Clear from storage
    try {
      chrome.storage.local.get('autoPrompts', (data) => {
        const autoPrompts = data.autoPrompts || [];
        let modified = false;
        
        // Remove this window from ALL auto prompt batches
        autoPrompts.forEach(batch => {
          if (batch.windowIndices && batch.windowIndices.includes(windowIndex)) {
            batch.windowIndices = batch.windowIndices.filter(idx => idx !== windowIndex);
            if (batch.windowTransforms && batch.windowTransforms[windowIndex]) {
              delete batch.windowTransforms[windowIndex];
            }
            modified = true;
            console.log(`[RTool] [Window ${windowIndex}] Removed from auto prompt batch ${batch.sharedAutoPromptId}`);
          }
        });
        
        // Save if modified
        if (modified) {
          chrome.storage.local.set({ autoPrompts: autoPrompts });
          console.log(`[RTool] [Window ${windowIndex}] Auto prompts cleared from storage`);
        }
      });
    } catch (e) {
      console.error(`[RTool] [Window ${windowIndex}] Error cleaning up auto prompts:`, e);
    }
    
    // Step 2: Clear from windowPromptMap (do this immediately, don't wait for storage)
    if (windowPromptMap[windowIndex]) {
      console.log(`[RTool] [Window ${windowIndex}] Clearing windowPromptMap entry (was: ${JSON.stringify(windowPromptMap[windowIndex])})`);
      delete windowPromptMap[windowIndex];
    }
    
    // Now set the manual prompt info
    windowPromptMap[windowIndex] = {
      basePrompt: 'Manual Prompt',
      transformedPrompt: prompt,
      transform: 'none:none',
      isManual: true,
      isAutoPrompt: false, // Explicitly mark as NOT an auto prompt
      responseId: responseId,
      timestamp: timestamp || new Date().toISOString(),
      source: source || 'manual_entry', // Track the source for debugging
      url: url, // Store URL for reference
      manualOverride: true // Special flag to indicate this is a manual entry that should override auto prompt info
    };
    
    // Log that we've set this window to manual mode
    console.log(`[RTool] Window ${windowIndex} is now in MANUAL MODE with prompt: ${prompt.substring(0, 30)}...`);
    
    // Also check if this window is part of any auto prompt batch and remove it
    chrome.storage.local.get('autoPrompts', (data) => {
      const autoPrompts = data.autoPrompts || [];
      let modified = false;
      
      // Remove this window from any auto prompt batches
      autoPrompts.forEach(batch => {
        if (batch.windowIndices && batch.windowIndices.includes(windowIndex)) {
          batch.windowIndices = batch.windowIndices.filter(idx => idx !== windowIndex);
          modified = true;
          console.log(`[RTool] Removed window ${windowIndex} from auto prompt batch ${batch.sharedAutoPromptId}`);
        }
      });
      
      // Save if modified
      if (modified) {
        chrome.storage.local.set({ autoPrompts: autoPrompts });
      }
    });
    
    // Create new manual entry with pending response
    // For manual entries, basePrompt should be "Manual Prompt" and prompt should be the actual text
    // Ensure we're not copying any auto prompt information
    const newEntry = {
      timestamp: timestamp || new Date().toISOString(),
      userId: userId.value.trim() || '(unknown)',
      url: siteUrl,
      windowIndex: windowIndex,
      basePrompt: 'Manual Prompt', // Label as manual prompt in basePrompt column
      transform: 'none:none', // No transform for manual
      prompt: prompt, // The actual prompt text
      response: '(pending)', // Will be updated when response comes
      responseId: responseId, // Unique ID to match responses
      isManual: true, // Flag as manual entry
      isAutoPrompt: false, // Explicitly mark as NOT an auto prompt
      success: true,
      source: source || 'manual_entry', // Track the source for debugging
      manualOverride: true // Special flag to indicate this is a manual entry that should override auto prompt info
    };
    
    // Log the manual entry details for debugging
    console.log(`[RTool] Creating new manual entry for window ${windowIndex}:`, 
      JSON.stringify({
        basePrompt: newEntry.basePrompt,
        prompt: prompt.substring(0, 30),
        isManual: true,
        responseId: responseId
      })
    );
    
    sessionLogs.push(newEntry);
    
    console.log(`[RTool] Added manual prompt entry for window ${windowIndex} with responseId: ${responseId}`);

    // Save to storage immediately to ensure it's not lost
    await chrome.storage.local.set({ 
      sessionLogs: sessionLogs,
      // Also save the latest window prompt map to ensure consistency
      windowPromptMap: windowPromptMap
    });
    
    updateLoggingStatus(`${sessionLogs.length} entries logged`);
  } catch (error) {
    console.error('[RTool] Failed to add manual prompt entry:', error);
  }
}

// Add a log entry (from conversation monitoring or manual interaction)
async function addLogEntry(windowIndex, prompt, response, timestamp, meta = {}) {
  try {
    const data = await chrome.storage.local.get('loggingEnabled');
    if (!data.loggingEnabled) {
      return;
    }

    console.log(`[RTool] ========================================`);
    console.log(`[RTool] addLogEntry called: window=${windowIndex}, prompt=${prompt ? prompt.substring(0, 30) : 'NULL'}, response length=${response?.length}`);
    console.log(`[RTool] Current windowPromptMap[${windowIndex}]:`, windowPromptMap[windowIndex] ? JSON.stringify(windowPromptMap[windowIndex]) : 'NULL');
    console.log(`[RTool] ========================================`);
    
    // Critical check - ensure windowIndex is valid
    if (windowIndex === null || windowIndex === undefined) {
      console.error('[RTool] Invalid window index in addLogEntry');
      windowIndex = 0; // Default to window 0 as fallback
    }
    
    // NEVER log pending responses
    if (response === '(pending)') {
      console.log('[RTool] Refusing to log "(pending)" placeholder');
      return;
    }
    
    // Check if this response is a duplicate
    const isDuplicate = sessionLogs.some(log => 
      log.windowIndex === windowIndex && 
      log.response === response && 
      log.response !== '(pending)'
    );
    
    if (isDuplicate) {
      console.log('[RTool] Duplicate response detected, skipping');
      return;
    }
    
    // STEP 1: Look for a pending entry with matching responseId
    // First, look for entries with a responseId that matches the window's latest prompt
    const latestPrompt = windowPromptMap[windowIndex];
    let matchedEntry = null;
    let matchedEntryIndex = -1;
    
    // Check if this is a manual prompt response
    // For manual prompts, we need to be more aggressive in checking
    // Prefer explicit meta flags if provided
    const explicitIsManual = meta && meta.isManual === true;
    const explicitIsAuto = meta && meta.isAuto === true;
    const isManualPrompt = explicitIsManual || (latestPrompt && (
      latestPrompt.isManual === true || 
      latestPrompt.manualOverride === true ||
      (latestPrompt.basePrompt === 'Manual Prompt')
    ));
    if (isManualPrompt) {
      console.log(`[RTool] This appears to be a response to a manual prompt for window ${windowIndex}`);
    }
    
    if (latestPrompt && latestPrompt.responseId && !explicitIsAuto) {
      // Only trust latestPrompt.responseId when we are NOT explicitly told this is an auto response.
      matchedEntryIndex = sessionLogs.findIndex(log => 
        log.responseId === latestPrompt.responseId && 
        log.response === '(pending)'
      );
      
      if (matchedEntryIndex !== -1) {
        matchedEntry = sessionLogs[matchedEntryIndex];
        console.log(`[RTool] Found matching entry by responseId: ${latestPrompt.responseId}`);
        
        // Ensure manual prompts are correctly labeled
        if (isManualPrompt) {
          console.log(`[RTool] Ensuring manual prompt is correctly labeled for window ${windowIndex}`);
          sessionLogs[matchedEntryIndex].basePrompt = 'Manual Prompt';
          sessionLogs[matchedEntryIndex].transform = 'none:none';
          sessionLogs[matchedEntryIndex].isManual = true;
          sessionLogs[matchedEntryIndex].isAutoPrompt = false;
        }
      }
    }
    
    // STEP 2: If no match by responseId, try matching by window index and pending status
    if (!matchedEntry) {
      // Get pending entries for this window
      const pendingEntriesForWindow = sessionLogs.filter(
        log => log.response === '(pending)' && log.windowIndex === windowIndex
      );
      
      if (pendingEntriesForWindow.length > 0) {
        console.log(`[RTool] Found ${pendingEntriesForWindow.length} pending entries for window ${windowIndex}`);
        
        // PRIORITY 1a: If explicitly AUTO, choose auto pending first
        if (explicitIsAuto) {
          const autoPendingEntry = pendingEntriesForWindow.find(log => 
            log.isManual !== true && log.isAutoPrompt === true
          );
          if (autoPendingEntry) {
            matchedEntry = autoPendingEntry;
            matchedEntryIndex = sessionLogs.indexOf(matchedEntry);
            console.log(`[RTool] [PRIORITY] Matched to AUTO pending entry for window ${windowIndex}`);
          }
        }

        // PRIORITY 1b: If we expect a manual prompt, look for manual entries first
        if (!matchedEntry && isManualPrompt) {
          const manualPendingEntry = pendingEntriesForWindow.find(log => 
            log.isManual === true || 
            log.manualOverride === true || 
            log.basePrompt === 'Manual Prompt'
          );
          
          if (manualPendingEntry) {
            matchedEntry = manualPendingEntry;
            matchedEntryIndex = sessionLogs.indexOf(matchedEntry);
            console.log(`[RTool] [PRIORITY] Matched to manual pending entry for window ${windowIndex}`);
          }
        }
        
        // PRIORITY 2: If still not found, use the most recent pending entry
        if (!matchedEntry) {
          // Sort by timestamp (newest first)
          pendingEntriesForWindow.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          matchedEntry = pendingEntriesForWindow[0];
          matchedEntryIndex = sessionLogs.indexOf(matchedEntry);
          console.log(`[RTool] Found matching entry by window index: ${windowIndex}, isManual: ${matchedEntry.isManual}, basePrompt: ${matchedEntry.basePrompt}`);
        }
        
        // Ensure manual prompts are correctly labeled
        if (isManualPrompt) {
          console.log(`[RTool] Ensuring manual prompt is correctly labeled for window ${windowIndex} (step 2)`);
          sessionLogs[matchedEntryIndex].basePrompt = 'Manual Prompt';
          sessionLogs[matchedEntryIndex].transform = 'none:none';
          sessionLogs[matchedEntryIndex].isManual = true;
          sessionLogs[matchedEntryIndex].isAutoPrompt = false;
          sessionLogs[matchedEntryIndex].manualOverride = true;
        }
      }
    }
    
    // STEP 3: If we found a matching entry, update it
    if (matchedEntry) {
      // Update the existing entry with the response
      sessionLogs[matchedEntryIndex].response = response;
      
      // Final check to ensure manual prompts are correctly labeled
      if (isManualPrompt) {
        console.log(`[RTool] Final check for manual prompt labeling for window ${windowIndex}`);
        sessionLogs[matchedEntryIndex].basePrompt = 'Manual Prompt';
        sessionLogs[matchedEntryIndex].transform = 'none:none';
        sessionLogs[matchedEntryIndex].isManual = true;
        sessionLogs[matchedEntryIndex].isAutoPrompt = false;
        sessionLogs[matchedEntryIndex].manualOverride = true;
      }
      
      // Special handling for Window 1 and Window 2 prompts
      // These windows seem to have issues with manual/auto detection
      if (windowIndex === 0 || windowIndex === 1) {
        // Only apply special handling if we don't have explicit auto prompt info
        // This is critical to avoid mislabeling auto prompts as manual
        const hasExplicitAutoPromptInfo = 
          sessionLogs[matchedEntryIndex].isAutoPrompt === true && 
          sessionLogs[matchedEntryIndex].basePrompt && 
          sessionLogs[matchedEntryIndex].basePrompt !== 'Manual Prompt';
        
        if (!hasExplicitAutoPromptInfo) {
          // Check if this looks like a manual prompt response
          const isLikelyManual = prompt && !prompt.includes('transform') && 
                                sessionLogs[matchedEntryIndex].prompt && 
                                sessionLogs[matchedEntryIndex].prompt.length < 500;
          
          if (isLikelyManual) {
            console.log(`[RTool] Special handling for Window ${windowIndex} likely manual prompt`);
            sessionLogs[matchedEntryIndex].basePrompt = 'Manual Prompt';
            sessionLogs[matchedEntryIndex].transform = 'none:none';
            sessionLogs[matchedEntryIndex].isManual = true;
            sessionLogs[matchedEntryIndex].isAutoPrompt = false;
            sessionLogs[matchedEntryIndex].manualOverride = true;
          }
        } else {
          console.log(`[RTool] Window ${windowIndex} has explicit auto prompt info, preserving it`);
        }
      }
      
      // Do NOT remove other pending entries; allow auto and manual entries to complete independently
      
      console.log(`[RTool] [Window ${windowIndex}] ✓ Updated entry with response: ${response.substring(0, 50)}...`);
      console.log(`[RTool] [Window ${windowIndex}] Entry details:`, {
        basePrompt: sessionLogs[matchedEntryIndex].basePrompt,
        transform: sessionLogs[matchedEntryIndex].transform,
        isManual: sessionLogs[matchedEntryIndex].isManual,
        isAutoPrompt: sessionLogs[matchedEntryIndex].isAutoPrompt
      });
      
      // Save to storage
      await chrome.storage.local.set({ sessionLogs: sessionLogs });
      updateLoggingStatus(`${sessionLogs.length} entries logged`);
      
      // Log current state for debugging
      const pendingCount = sessionLogs.filter(log => log.response === '(pending)').length;
      const completedCount = sessionLogs.filter(log => log.response !== '(pending)').length;
      console.log(`[RTool] Current log state: ${completedCount} completed, ${pendingCount} pending`);
      
      return;
    }
    
    // STEP 4: If no matching entry was found, create a new one
    console.log(`[RTool] ⚠️ No matching entry found for window ${windowIndex}`);
    console.log(`[RTool] [Window ${windowIndex}] Current windowPromptMap:`, windowPromptMap[windowIndex] ? JSON.stringify(windowPromptMap[windowIndex]) : 'NULL');
    console.log(`[RTool] [Window ${windowIndex}] All pending entries:`, sessionLogs.filter(log => log.response === '(pending)').map(log => ({
      window: log.windowIndex,
      basePrompt: log.basePrompt?.substring(0, 20),
      isManual: log.isManual
    })));
    
    // CRITICAL: If windowPromptMap indicates this is a manual prompt, DO NOT fall back to auto-prompt reconstruction
    if ((meta && meta.isManual === true) || (windowPromptMap[windowIndex] && windowPromptMap[windowIndex].isManual === true)) {
      console.warn(`[RTool] [Window ${windowIndex}] Manual response arrived without pending entry - creating completed manual entry now`);
      
      // Build completed manual entry using available prompt information
      const siteKey = siteSelect.value;
      const siteConfig = getSiteConfig(siteKey);
      const siteUrl = siteConfig ? siteConfig.url.replace('https://', '').replace(/\/$/, '') : '';
      
      const storedPromptInfo = windowPromptMap[windowIndex] || {};
      const manualPromptText = prompt || storedPromptInfo.transformedPrompt || storedPromptInfo.basePrompt || 'Manual Prompt';
      
      const responseId = `manual_now_${windowIndex}_${nextResponseId++}`;
      
      sessionLogs.push({
        timestamp: timestamp || new Date().toISOString(),
        userId: userId.value.trim() || '(unknown)',
        url: siteUrl,
        windowIndex: windowIndex,
        basePrompt: 'Manual Prompt',
        transform: 'none:none',
        prompt: manualPromptText,
        response: response,
        responseId: responseId,
        isManual: true,
        isAutoPrompt: false,
        success: true,
        manualOverride: true
      });
      
      await chrome.storage.local.set({ sessionLogs: sessionLogs });
      updateLoggingStatus(`${sessionLogs.length} entries logged`);
      console.log(`[RTool] [Window ${windowIndex}] ✓ Created completed manual entry on-the-fly`);
      return;
    }
    
    console.log(`[RTool] Creating fallback entry for window ${windowIndex}`);
    
    // Generate a unique response ID for this fallback entry
    const responseId = `fallback_${nextResponseId++}`;
    
    // Get current site URL
    const siteKey = siteSelect.value;
    const siteConfig = getSiteConfig(siteKey);
    const siteUrl = siteConfig ? siteConfig.url.replace('https://', '').replace(/\/$/, '') : '';
    
    // STEP 4.1: First check if this window is part of a shared auto prompt batch
    // Load stored auto prompts
    try {
      // Load both auto prompts and the window prompt map to ensure we have the most complete information
      const [autoPromptsData, storedWindowPromptMap] = await Promise.all([
        chrome.storage.local.get('autoPrompts'),
        chrome.storage.local.get('windowPromptMap')
      ]);
      
      const autoPrompts = autoPromptsData.autoPrompts || [];
      const storedMap = storedWindowPromptMap.windowPromptMap || {};
      
      // If we have stored window prompt map data, merge it with our current map
      if (Object.keys(storedMap).length > 0) {
        console.log('[RTool] Found stored window prompt map, merging with current');
        // Only update entries we don't already have
        Object.keys(storedMap).forEach(idx => {
          if (!windowPromptMap[idx] && storedMap[idx]) {
            windowPromptMap[idx] = storedMap[idx];
          }
        });
      }
      
      // Find if this window is part of any auto prompt batch
      // Sort by timestamp descending to get the most recent first
      autoPrompts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      const matchingBatch = autoPrompts.find(batch => 
        batch.windowIndices && batch.windowIndices.includes(windowIndex)
      );
      
      if (matchingBatch) {
        console.log(`[RTool] Found matching auto prompt batch for window ${windowIndex}:`, matchingBatch);
        
        // This is an auto-prompt window, use the shared base prompt
        // Get the transform for this window from the batch
        const windowTransform = matchingBatch.windowTransforms?.[windowIndex] || 'none:none';
        
        // If we have a transform, apply it to get the transformed prompt
        let transformedPrompt = prompt || matchingBatch.basePrompt;
        if (windowTransform !== 'none:none' && matchingBatch.basePrompt) {
          // Parse the transform
          const transformParts = windowTransform.split(':');
          const transformObj = {
            category: transformParts[0],
            method: transformParts[1]
          };
          
          // Apply transform if possible
          try {
            transformedPrompt = applyTransformForLog(matchingBatch.basePrompt, transformObj);
          } catch (e) {
            console.error('[RTool] Error applying transform:', e);
          }
        }
        
        // Store this information in the window prompt map for future reference
        windowPromptMap[windowIndex] = {
          basePrompt: matchingBatch.basePrompt,
          transformedPrompt: transformedPrompt,
          transform: windowTransform,
          isManual: false,
          isAutoPrompt: true,
          sharedAutoPromptId: matchingBatch.sharedAutoPromptId,
          timestamp: matchingBatch.timestamp
        };
        
        // Save the updated window prompt map to storage
        chrome.storage.local.set({ windowPromptMap: windowPromptMap });
        
        sessionLogs.push({
          timestamp: timestamp || new Date().toISOString(),
          userId: userId.value.trim() || '(unknown)',
          url: siteUrl,
          windowIndex: windowIndex,
          basePrompt: matchingBatch.basePrompt, // Use the shared base prompt
          transform: windowTransform, // Use the window-specific transform
          prompt: transformedPrompt, // Use transformed prompt if available
          response: response,
          responseId: responseId,
          sharedAutoPromptId: matchingBatch.sharedAutoPromptId,
          isManual: false, // Mark as auto-prompt, not manual
          isAutoPrompt: true,
          success: true
        });
        
        console.log(`[RTool] Created entry for window ${windowIndex} using shared auto prompt batch`);
        return;
      }
    } catch (error) {
      console.error('[RTool] Error checking auto prompt batches:', error);
    }
    
    // STEP 4.2: Check if we have window-specific prompt info
    if (windowPromptMap[windowIndex]) {
      // Use the stored prompt information
      const storedPrompt = windowPromptMap[windowIndex];
      
      // For auto-prompts, ensure we have the base prompt and transform
      if (storedPrompt.isAutoPrompt && !storedPrompt.isManual) {
        console.log(`[RTool] Using stored auto-prompt info for window ${windowIndex}`);
        
        // Check if we need to apply a transform
        let transformedPrompt = storedPrompt.transformedPrompt || prompt || storedPrompt.basePrompt;
        if (!storedPrompt.transformedPrompt && storedPrompt.transform !== 'none:none' && storedPrompt.basePrompt) {
          // Parse the transform
          const transformParts = storedPrompt.transform.split(':');
          const transformObj = {
            category: transformParts[0],
            method: transformParts[1]
          };
          
          // Apply transform if possible
          try {
            transformedPrompt = applyTransformForLog(storedPrompt.basePrompt, transformObj);
          } catch (e) {
            console.error('[RTool] Error applying transform:', e);
          }
        }
        
        sessionLogs.push({
          timestamp: timestamp || new Date().toISOString(),
          userId: userId.value.trim() || '(unknown)',
          url: siteUrl,
          windowIndex: windowIndex,
          basePrompt: storedPrompt.basePrompt,
          transform: storedPrompt.transform,
          prompt: transformedPrompt,
          response: response,
          responseId: responseId,
          sharedAutoPromptId: storedPrompt.sharedAutoPromptId,
          isManual: false,
          isAutoPrompt: true,
          success: true
        });
      } else {
        // For manual prompts, use the stored information
        sessionLogs.push({
          timestamp: timestamp || new Date().toISOString(),
          userId: userId.value.trim() || '(unknown)',
          url: siteUrl,
          windowIndex: windowIndex,
          basePrompt: storedPrompt.basePrompt,
          transform: storedPrompt.transform,
          prompt: storedPrompt.transformedPrompt || prompt,
          response: response,
          responseId: responseId,
          sharedAutoPromptId: storedPrompt.sharedAutoPromptId,
          isManual: storedPrompt.isManual,
          isAutoPrompt: storedPrompt.isAutoPrompt || false,
          success: true
        });
      }
      
      console.log(`[RTool] Created new entry using stored prompt info for window ${windowIndex}`);
    } else {
    // STEP 4.3: Check if any other window has auto-prompt info we can use
    // This is a more general approach that works for any window
    let foundAutoPrompt = false;
    
    // First, check if we have any auto-prompt batches that include this window
    try {
      const autoPromptsData = await chrome.storage.local.get('autoPrompts');
      const autoPrompts = autoPromptsData.autoPrompts || [];
      
      // Sort by timestamp descending to get the most recent first
      autoPrompts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Find if this window is part of any auto prompt batch
      const matchingBatch = autoPrompts.find(batch => 
        batch.windowIndices && batch.windowIndices.includes(windowIndex)
      );
      
      if (matchingBatch) {
        console.log(`[RTool] Found matching auto prompt batch for window ${windowIndex} in storage:`, matchingBatch);
        
        // Get the transform for this window from the batch
        const windowTransform = matchingBatch.windowTransforms?.[windowIndex] || 'none:none';
        
        // This is an auto-prompt window, use the shared base prompt
        sessionLogs.push({
          timestamp: timestamp || new Date().toISOString(),
          userId: userId.value.trim() || '(unknown)',
          url: siteUrl,
          windowIndex: windowIndex,
          basePrompt: matchingBatch.basePrompt, // Use the shared base prompt
          transform: windowTransform, // Use the window-specific transform
          prompt: prompt || matchingBatch.basePrompt, // Use provided prompt or base prompt
          response: response,
          responseId: responseId,
          sharedAutoPromptId: matchingBatch.sharedAutoPromptId,
          isManual: false, // Mark as auto-prompt, not manual
          isAutoPrompt: true,
          success: true
        });
        
        // Store this info for future reference
        windowPromptMap[windowIndex] = {
          basePrompt: matchingBatch.basePrompt,
          transformedPrompt: prompt || matchingBatch.basePrompt,
          transform: windowTransform,
          isManual: false,
          isAutoPrompt: true,
          sharedAutoPromptId: matchingBatch.sharedAutoPromptId,
          timestamp: matchingBatch.timestamp
        };
        
        // Save the updated window prompt map
        await chrome.storage.local.set({ windowPromptMap: windowPromptMap });
        
        foundAutoPrompt = true;
      }
    } catch (error) {
      console.error('[RTool] Error checking auto prompt batches:', error);
    }
    
    // If we didn't find a batch, look for any window with auto-prompt info
    if (!foundAutoPrompt) {
      for (let idx in windowPromptMap) {
        const otherWindowPrompt = windowPromptMap[idx];
        if (otherWindowPrompt && otherWindowPrompt.isAutoPrompt && !otherWindowPrompt.isManual) {
          console.log(`[RTool] Found auto-prompt info in window ${idx}, using for window ${windowIndex}`);
          
          // This is another window's auto-prompt, so use its base prompt
          sessionLogs.push({
            timestamp: timestamp || new Date().toISOString(),
            userId: userId.value.trim() || '(unknown)',
            url: siteUrl,
            windowIndex: windowIndex,
            basePrompt: otherWindowPrompt.basePrompt, // Use the other window's base prompt
            transform: otherWindowPrompt.transform || 'none:none', // Use the transform if available
            prompt: prompt || otherWindowPrompt.transformedPrompt || otherWindowPrompt.basePrompt,
            response: response,
            responseId: responseId,
            sharedAutoPromptId: otherWindowPrompt.sharedAutoPromptId,
            isManual: false, // Mark as auto-prompt, not manual
            isAutoPrompt: true,
            success: true
          });
          
          // Store this info for future reference
          windowPromptMap[windowIndex] = {
            basePrompt: otherWindowPrompt.basePrompt,
            transformedPrompt: prompt || otherWindowPrompt.transformedPrompt || otherWindowPrompt.basePrompt,
            transform: otherWindowPrompt.transform || 'none:none',
            isManual: false,
            isAutoPrompt: true,
            sharedAutoPromptId: otherWindowPrompt.sharedAutoPromptId,
            timestamp: otherWindowPrompt.timestamp || new Date().toISOString()
          };
          
          // Save the updated window prompt map
          await chrome.storage.local.set({ windowPromptMap: windowPromptMap });
          
          foundAutoPrompt = true;
          break;
        }
      }
    }
      
      if (!foundAutoPrompt) {
        // STEP 4.4: Fallback case - create a generic entry
        // Check if this is likely a manual prompt based on content
        const isLikelyManual = prompt && !prompt.includes('transform') && windowIndex > 0;
        const isManualResponse = !prompt || isLikelyManual;
        const basePromptText = isManualResponse ? 'Manual Prompt' : (prompt || 'Unknown Prompt');
        const promptText = prompt || 'Unknown Prompt';
        
        sessionLogs.push({
          timestamp: timestamp || new Date().toISOString(),
          userId: userId.value.trim() || '(unknown)',
          url: siteUrl,
          windowIndex: windowIndex,
          basePrompt: basePromptText,
          transform: 'none:none',
          prompt: promptText,
          response: response,
          responseId: responseId,
          isManual: isManualResponse,
          isAutoPrompt: false,
          success: true
        });
        
        console.log(`[RTool] Created generic fallback entry for window ${windowIndex}, isManual: ${isManualResponse}`);
      }
    }
    
    // Save to storage
    await chrome.storage.local.set({ sessionLogs: sessionLogs });
    updateLoggingStatus(`${sessionLogs.length} entries logged`);
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

// Clear log buffer on startup
async function clearLogBufferOnStartup() {
  try {
    const clearOnStartup = await chrome.storage.local.get('clearLogsOnStartup');
    
    // Default to true if not set
    const shouldClear = clearOnStartup.clearLogsOnStartup !== false;
    
    if (shouldClear) {
      console.log('[RTool] Clearing log buffer on startup');
      
      // Clear all logs and tracking variables
      sessionLogs = [];
      windowPromptMap = {};
      nextResponseId = 1;
      
      // Save empty logs to storage
      await chrome.storage.local.set({ 
        sessionLogs: [],
        windowPromptMap: {}, // Clear window prompt map too
        // Store the preference to clear logs on startup
        clearLogsOnStartup: true
      });
      
      console.log('[RTool] Log buffer cleared on startup');
    } else {
      console.log('[RTool] Keeping existing logs on startup (clearLogsOnStartup is disabled)');
    }
  } catch (error) {
    console.error('[RTool] Error clearing log buffer on startup:', error);
  }
}

// Initialize on page load
(async function initialize() {
  try {
    // First clear the log buffer if enabled
    await clearLogBufferOnStartup();
    
    // Load stored window prompt map if available
    try {
      const data = await chrome.storage.local.get('windowPromptMap');
      if (data.windowPromptMap && Object.keys(data.windowPromptMap).length > 0) {
        console.log('[RTool] Loaded stored window prompt map');
        // Merge with any existing data
        windowPromptMap = {...windowPromptMap, ...data.windowPromptMap};
      }
    } catch (e) {
      console.error('[RTool] Error loading window prompt map:', e);
    }
    
    // Then load settings and configuration
    await loadUserSettings();
    await loadLoggingConfig();
    await loadWindows();
    
    // Start monitoring conversations
    chrome.runtime.sendMessage({ action: 'startMonitoring' });
    
    updateStatus('Ready. Open windows to begin.', 'normal');
  } catch (error) {
    console.error('Initialization error:', error);
    updateStatus('Error initializing extension', 'error');
  }
})();

