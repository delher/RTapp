// Popup UI logic for RTool Chrome Extension

const userId = document.getElementById('userId');
const instanceCount = document.getElementById('instanceCount');
const siteUrl = document.getElementById('siteUrl');
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
  const headers = ['Timestamp', 'User ID', 'Window', 'Base Prompt', 'Transform', 'Prompt', 'Response', 'Source'];
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
      log.userId || '',
      windowName,
      `"${(log.basePrompt || '').replace(/"/g, '""')}"`, // Base prompt (untransformed)
      log.transform || 'none:none',
      `"${(log.prompt || '').replace(/"/g, '""')}"`, // Transformed prompt
      `"${(log.response || '(pending)').replace(/"/g, '""')}"`,
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
      
      sessionLogs.push({
        timestamp: timestamp,
        userId: userIdValue,
        windowIndex: result.index,
        basePrompt: prompt, // Original untransformed prompt
        transform: result.transform || 'none:none',
        prompt: transformedPrompt, // Transformed prompt
        response: '(pending)',
        success: result.success || false,
        source: 'rtool'
      });
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

    // Try to find a pending entry for this window with matching prompt or basePrompt
    const windowPendingIndex = sessionLogs.findIndex(
      log => log.windowIndex === windowIndex && 
             (log.prompt === prompt || log.basePrompt === prompt) && 
             log.response === '(pending)'
    );

    if (windowPendingIndex !== -1) {
      // Update existing window entry with response
      sessionLogs[windowPendingIndex].response = response;
      console.log(`[RTool] Updated window ${windowIndex} log entry with response`);
    } else {
      // Add new entry (manual interaction)
      const userIdValue = userId.value.trim() || '(unknown)';
      sessionLogs.push({
        timestamp: timestamp || new Date().toISOString(),
        userId: userIdValue,
        windowIndex: windowIndex,
        basePrompt: prompt, // Manual entries: base = prompt
        transform: 'none:none', // Manual entries have no transform
        prompt: prompt, // Manual entries: prompt = base
        response: response,
        success: true,
        source: 'manual'
      });
      console.log('[RTool] Added manual interaction to log');
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

