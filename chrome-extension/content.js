// Content script that runs in each opened window
// Handles prompt injection, transformation, and conversation monitoring

// VERSION: 1.3.8 - Removed waitingForResponse check from manual prompt detection
var CONTENT_SCRIPT_VERSION = window.CONTENT_SCRIPT_VERSION || '1.3.8';
window.CONTENT_SCRIPT_VERSION = CONTENT_SCRIPT_VERSION;

console.log('[RTool] ========== CONTENT SCRIPT STARTING ==========');
console.log(`[RTool] Content script version: ${CONTENT_SCRIPT_VERSION}`);
console.log('[RTool] Script execution context:', typeof window, typeof document);
console.log('[RTool] Current window.RTOOL_INITIALIZED:', window.RTOOL_INITIALIZED);
console.log('[RTool] Current window.RTOOL_LOADED:', window.RTOOL_LOADED);
console.log('[RTool] Current window.RTOOL_VERSION:', window.RTOOL_VERSION);

// Check if already initialized BEFORE doing anything
var wasInitialized = window.RTOOL_INITIALIZED === true;

// ALWAYS set these flags (even on re-load)
console.log('[RTool] Setting window.RTOOL_LOADED = true...');
window.RTOOL_LOADED = true;
console.log('[RTool] After setting, window.RTOOL_LOADED =', window.RTOOL_LOADED);

console.log(`[RTool] Setting window.RTOOL_VERSION = ${CONTENT_SCRIPT_VERSION}...`);
window.RTOOL_VERSION = CONTENT_SCRIPT_VERSION;
console.log('[RTool] After setting, window.RTOOL_VERSION =', window.RTOOL_VERSION);

console.log('[RTool] Setting window.RTOOL_INITIALIZED = true...');
window.RTOOL_INITIALIZED = true;
console.log('[RTool] After setting, window.RTOOL_INITIALIZED =', window.RTOOL_INITIALIZED);

// Only log initialization messages on first load
if (!wasInitialized) {
  console.log('=== RTOOL CONTENT SCRIPT LOADED (FIRST TIME) ===');
  console.log('[RTool] Content script loaded at:', new Date().toISOString());
  console.log('[RTool] Running on URL:', window.location.href);
  console.log('[RTool] Document ready state:', document.readyState);

  // Test basic functionality
  try {
    console.log('[RTool] Basic DOM access test:', document.body ? 'OK' : 'FAILED');
  } catch (e) {
    console.error('[RTool] DOM access error:', e);
  }
} else {
  console.warn('[RTool] content.js already initialized, skipping initialization logs');
}

console.log('[RTool] ========== CONTENT SCRIPT INITIALIZATION COMPLETE ==========');

// State for conversation monitoring (use var to allow re-declaration)
var conversationObserver = window.conversationObserver || null;

// Clean up lastPrompt if it contains garbage from previous page state
var lastPrompt = window.lastPrompt || null;
// CRITICAL: Always clear lastPrompt on initialization to prevent garbage from persisting
// This is especially important for ChatGPT which can have script tags in the DOM
console.log('[RTool] Initialization: lastPrompt =', lastPrompt ? lastPrompt.substring(0, 50) : 'NULL');
if (lastPrompt && (
  lastPrompt.includes('window.__oai_') ||
  lastPrompt.includes('Date.now') ||
  lastPrompt.includes('requestAnimationFrame') ||
  (lastPrompt.includes('window.') && lastPrompt.includes('('))
)) {
  console.log('[RTool] ⚠️ Clearing garbage from lastPrompt:', lastPrompt.substring(0, 50));
  lastPrompt = null;
  window.lastPrompt = null;
}
// EXTRA SAFETY: For ChatGPT, always start with NULL to prevent any garbage
if (window.location.href.includes('chatgpt.com')) {
  console.log('[RTool] ChatGPT detected - forcing lastPrompt to NULL for safety');
  lastPrompt = null;
  window.lastPrompt = null;
}

var lastResponse = window.lastResponse || null;
var windowIndex = window.windowIndex || null;
var isMonitoring = window.isMonitoring || false;
var responseDebounceTimer = window.responseDebounceTimer || null;
var pendingResponse = window.pendingResponse || null;
var isLoggingResponse = window.isLoggingResponse || false; // Prevent concurrent logging
var lastResponseTime = window.lastResponseTime || 0; // Track when response was last updated
var currentSiteKey = window.currentSiteKey || null;  // Current site configuration key
var currentSiteConfig = window.currentSiteConfig || null;  // Current site configuration object
var responseHistory = window.responseHistory || []; // Track response history to prevent duplicates
var lastLoggedResponseTime = window.lastLoggedResponseTime || 0; // Track when we last logged a response
var responseStableCount = window.responseStableCount || 0; // Counter for stable response detection

// NEW: Robust prompt tracking for ChatGPT
// This prevents DOM garbage from corrupting the prompt
var injectedPrompt = window.injectedPrompt || null; // The prompt that was injected via RTool
var injectedPromptTimestamp = window.injectedPromptTimestamp || 0; // When it was injected
var waitingForResponse = window.waitingForResponse || false; // Are we waiting for a response to the injected prompt?

// Listen for messages from background script (guard against duplicate listeners)
if (!window.RTOOL_MESSAGE_LISTENER_ADDED) {
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[RTool] Content script received message:', request.action, 'at', new Date().toISOString());

  if (request.action === 'ping') {
    // Quick health check
    sendResponse({ status: 'ready' });
    return false;
  }

  if (request.action === 'injectPrompt') {
    console.log('[RTool] Received inject prompt request');
    windowIndex = request.windowIndex;
    if (request.siteKey) {
      currentSiteKey = request.siteKey;
      currentSiteConfig = getSiteConfig(currentSiteKey);
      console.log('[RTool] Using site config:', currentSiteKey, currentSiteConfig?.name);
    }
    injectPrompt(request.prompt, request.transform).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'startMonitoring') {
    console.log('[RTool] Received startMonitoring message');
    windowIndex = request.windowIndex;
    if (request.siteKey) {
      currentSiteKey = request.siteKey;
      currentSiteConfig = getSiteConfig(currentSiteKey);
      console.log('[RTool] Set site config for monitoring:', currentSiteKey, currentSiteConfig?.name);
    }
    startConversationMonitoring();
    sendResponse({ success: true });
  } else if (request.action === 'stopMonitoring') {
    console.log('[RTool] Stopping conversation monitoring');
    stopConversationMonitoring();
    sendResponse({ success: true });
  } else if (request.action === 'debugDOM') {
    console.log('[RTool] Received debugDOM request');
    debugDOM();
    sendResponse({ success: true });
  }
});
window.RTOOL_MESSAGE_LISTENER_ADDED = true;
}

// Inject and submit prompt
async function injectPrompt(rawPrompt, transform) {
  try {
    console.log('[RTool] Received transform:', transform);
    console.log('[RTool] Raw prompt:', rawPrompt);
    
    // Apply transform
    const prompt = applyTransform(rawPrompt, transform);
    console.log(`[RTool] Transformed prompt (${transform.category}:${transform.method}):`, prompt);
    
    // CRITICAL: Set injected prompt tracking BEFORE injection
    // This prevents DOM garbage from corrupting our prompt tracking
    injectedPrompt = prompt;
    injectedPromptTimestamp = Date.now();
    waitingForResponse = true;
    lastPrompt = prompt; // Also set lastPrompt for compatibility
    
    // Store in window for persistence
    window.injectedPrompt = injectedPrompt;
    window.injectedPromptTimestamp = injectedPromptTimestamp;
    window.waitingForResponse = waitingForResponse;
    window.lastPrompt = lastPrompt;
    
    // CRITICAL: Block manual prompt captures while waiting for auto-prompt response
    // This prevents garbage from overwriting the correct auto-prompt info
    window.blockManualPromptCapture = true;
    console.log(`[RTool] [Window ${windowIndex}] BLOCKING manual prompt capture until auto-prompt response received`);
    
    console.log(`[RTool] [Window ${windowIndex}] Set injected prompt tracking:`, prompt.substring(0, 50));
    
    // Find input field
    const input = document.querySelector('#prompt-textarea') || 
                 document.querySelector('div[contenteditable="true"][role="textbox"]') ||
                 document.querySelector('[contenteditable="true"]') ||
                 document.querySelector('textarea');
    
    if (!input) {
      console.error('[RTool] Input field not found');
      return { success: false, error: 'Input field not found' };
    }
    
    console.log('[RTool] Found input:', input.id || input.className);
    
    // Focus input
    input.focus();
    
    // Set value based on input type
    if (input.getAttribute('contenteditable') === 'true') {
      // ContentEditable (like ChatGPT)
      input.innerHTML = '<p>' + prompt + '</p>';
    } else if (input.tagName === 'TEXTAREA') {
      // Regular textarea
      input.value = prompt;
    }
    
    // Dispatch events
    ['input', 'change', 'keyup'].forEach(eventType => {
      input.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
    });
    
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: prompt
    }));
    
    console.log('[RTool] Prompt set, waiting for send button...');
    
    // Wait for React to process
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find and click send button
    const sendBtn = document.querySelector('button[data-testid="send-button"]') ||
                   document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
                   document.querySelector('button[aria-label*="Send" i]') ||
                   document.querySelector('button[aria-label*="submit" i]');
    
    if (sendBtn && !sendBtn.disabled) {
      console.log('[RTool] Clicking send button');
      sendBtn.click();
      return { success: true, method: 'button' };
    } else {
      console.log('[RTool] Send button not found or disabled, trying Enter key');
      // Fallback: press Enter
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
      return { success: true, method: 'enter' };
    }
  } catch (error) {
    console.error('[RTool] Error injecting prompt:', error);
    return { success: false, error: error.message };
  }
}

// Parseltongue transforms (same as Electron app) (use var to allow re-declaration)
var transforms = window.rtoolTransforms || {
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

// Store transforms in window for reuse
window.rtoolTransforms = transforms;

// Apply transform
function applyTransform(text, transform) {
  if (!transform || transform.category === 'none' || transform.method === 'none') {
    return text;
  }
  
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

// Start monitoring conversation for manual interactions
function startConversationMonitoring() {
  console.log('[RTool] startConversationMonitoring called');
  if (isMonitoring || window.isMonitoring === true) {
    console.log('[RTool] Already monitoring, skipping');
    return;
  }
  
  // CRITICAL: Ensure DOM is ready before starting monitoring
  if (!document.body) {
    console.warn('[RTool] DOM not ready (no body), waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[RTool] DOM ready, starting monitoring now');
      startConversationMonitoring();
    });
    return;
  }
  
  // EXTRA SAFETY: For ChatGPT, ensure main element exists
  if (window.location.href.includes('chatgpt.com')) {
    const main = document.querySelector('main');
    if (!main) {
      console.warn('[RTool] ChatGPT main element not found, waiting 500ms...');
      setTimeout(() => {
        console.log('[RTool] Retrying monitoring after delay');
        startConversationMonitoring();
      }, 500);
      return;
    }
  }
  
  isMonitoring = true;
  window.isMonitoring = true;
  console.log('[RTool] Starting conversation monitoring');

  // Also monitor for user input submissions (manual prompts)
  setupUserInputMonitoring();

  // Watch for new messages in the conversation
  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  conversationObserver = new MutationObserver((mutations) => {
    console.log(`[RTool] MutationObserver fired: ${mutations.length} mutations`);
    
    // CRITICAL: Don't try to extract if DOM is not ready
    if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
      console.log(`[RTool] [Window ${windowIndex}] DOM not ready (${document.readyState}), skipping`);
      return;
    }
    
    // Look for new conversation items
    const messages = extractConversationMessages();

    if (messages.length === 0) {
      console.log(`[RTool] [Window ${windowIndex}] ⚠️ No messages found, skipping`);
      console.log(`[RTool] [Window ${windowIndex}] Current URL:`, window.location.href);
      console.log(`[RTool] [Window ${windowIndex}] Is this a conversation page?`, window.location.href.includes('/c/'));
      console.log(`[RTool] [Window ${windowIndex}] Document ready state:`, document.readyState);
      return; // No messages found, skip
    }

    const latest = messages[messages.length - 1];
    console.log('[RTool] Found', messages.length, 'messages. Latest:', latest.role, '(' + latest.content.length + ' chars)');
    console.log('[RTool] Latest content preview:', latest.content.substring(0, 80));
    console.log('[RTool] Current lastPrompt:', lastPrompt ? lastPrompt.substring(0, 50) : 'NULL');
    
    // Filter out UI elements and garbage content
    const uiPatterns = [
      'Get Plus',
      'ChatGPT said:',
      'You said:',
      'Temporary Chat',
      'window.__oai_',
      'requestAnimationFrame',
      "won't appear in history",
      'What can I help with?',
      'How can I help',
      'Get GPT',
      'Upgrade',
      'limit for GPT',
      '__oai_logHTML',
      '__oai_SSR_HTML',
      '__oai_logTTI',
      '__oai_SSR_TTI',
      'window.__oai_logHTML?window.__oai_logHTML()',
      'Date.now()',
      'window.__oai'
    ];
    
    const contentLower = latest.content.toLowerCase();
    const isUIElement = uiPatterns.some(pattern => contentLower.includes(pattern.toLowerCase()));
    
    // Also check if content looks like a script tag or code
    // More aggressive detection: if it has window. and parentheses, it's likely code
    const looksLikeCode = (latest.content.includes('window.') && latest.content.includes('(')) ||
                          (latest.content.includes('window.') && latest.content.includes('function')) ||
                          (latest.content.includes('__oai_')) ||
                          (latest.content.includes('Date.now'));
    
    if (isUIElement || looksLikeCode) {
      console.log('[RTool] Skipping UI element or page content:', latest.content.substring(0, 100));
      return;
    }

    // CRITICAL: Before processing, check if lastPrompt contains garbage and clear it
    if (lastPrompt && (
      lastPrompt.includes('window.__oai_') ||
      lastPrompt.includes('Date.now') ||
      lastPrompt.includes('requestAnimationFrame') ||
      (lastPrompt.includes('window.') && lastPrompt.includes('('))
    )) {
      console.log(`[RTool] [Window ${windowIndex}] ⚠️ CLEARING garbage from lastPrompt:`, lastPrompt.substring(0, 50));
      lastPrompt = null;
      window.lastPrompt = null;
    }
    
    // Check if it's a new prompt or response
    if (latest.role === 'user' && latest.content !== lastPrompt) {
      // If an auto-prompt response is in progress and substantial, flush it now
      if (currentSiteKey === 'chatgpt' && waitingForResponse && injectedPrompt && pendingResponse) {
        const minAutoLen = 50;
        if (!isLoggingResponse && pendingResponse.length >= minAutoLen) {
          console.log(`[RTool] [Window ${windowIndex}] Flushing in-progress AUTO response before manual prompt`);
          logCompletedResponse(pendingResponse);
        }
      }
      // FOR CHATGPT: If waiting for an auto-prompt response, only ignore if the DOM-detected
      // prompt is exactly the injected one. If it's different, treat it as a manual prompt.
      if (currentSiteKey === 'chatgpt' && waitingForResponse && injectedPrompt) {
        if (latest.content === injectedPrompt) {
          console.log(`[RTool] [Window ${windowIndex}] [ChatGPT] Ignoring DOM-detected injected prompt (already tracked)`);
          if (!lastPrompt || lastPrompt === 'NULL') {
            lastPrompt = injectedPrompt;
            window.lastPrompt = injectedPrompt;
          }
          return;
        } else {
          console.log(`[RTool] [Window ${windowIndex}] [ChatGPT] DOM-detected prompt differs from injected; will handle as manual`);
        }
      }
      
      // CRITICAL: Double-check that this isn't garbage before setting lastPrompt
      const isGarbage = (latest.content.includes('window.__oai_') ||
                        latest.content.includes('Date.now') ||
                        latest.content.includes('requestAnimationFrame') ||
                        (latest.content.includes('window.') && latest.content.includes('(')));
      
      if (isGarbage) {
        console.log('[RTool] ⚠️ BLOCKED attempt to set lastPrompt to garbage:', latest.content.substring(0, 100));
        return; // Don't set lastPrompt to garbage
      }
      
      console.log('[RTool] ✓ Detected NEW user prompt from DOM:', latest.content.substring(0, 100));
      
      // ========== CRITICAL: DETECT MANUAL PROMPTS FROM DOM ==========
      // This is the key fix - detect manual prompts when they appear in the DOM
      // Check if this is a MANUAL prompt (not the auto-prompt we injected)
      
      // CRITICAL: Check if this prompt is the same as lastPrompt BEFORE updating lastPrompt
      // If it is, it means we already processed it (either as auto or manual)
      // Don't process it again to avoid duplicates
      const isNewPrompt = (lastPrompt !== latest.content);
      
      // Now set lastPrompt for future comparisons
      lastPrompt = latest.content;
      
      // Reset response state for new prompt
      lastResponse = null;
      pendingResponse = null;
      isLoggingResponse = false;
      lastResponseTime = 0; // Reset response timing
      if (responseDebounceTimer) {
        clearTimeout(responseDebounceTimer);
        responseDebounceTimer = null;
      }
      
      // CRITICAL: Determine if this is a manual prompt
      // A prompt is manual if:
      // 1. It's new (not already processed)
      // 2. It's not the auto-prompt we injected
      // 3. We're on ChatGPT
      // NOTE: We DON'T check waitingForResponse here because if the user types a manual prompt
      // while waiting for an auto-prompt response, we still want to detect it!
      const isManualPrompt = (
        isNewPrompt &&  // Must be a NEW prompt we haven't seen
        latest.content !== injectedPrompt &&  // Not the auto-prompt we injected
        currentSiteKey === 'chatgpt'  // Only for ChatGPT (Gemini uses input monitoring)
      );
      
      if (isManualPrompt) {
        console.log(`[RTool] [Window ${windowIndex}] 🔍 DETECTED NEW MANUAL PROMPT FROM DOM:`, latest.content.substring(0, 50));
        console.log(`[RTool] [Window ${windowIndex}] Manual prompt detection state: waitingForResponse=${waitingForResponse}, injectedPrompt=${injectedPrompt ? injectedPrompt.substring(0, 30) : 'NULL'}`);
        
        // Call captureManualPrompt to send it to the popup for logging
        captureManualPrompt(latest.content);
      } else {
        if (!isNewPrompt) {
          console.log(`[RTool] [Window ${windowIndex}] User prompt already processed (lastPrompt matches), skipping`);
        } else {
          console.log(`[RTool] [Window ${windowIndex}] User prompt detected but NOT manual (waitingForResponse=${waitingForResponse}, isInjected=${latest.content === injectedPrompt})`);
        }
      }
      // ==============================================================
    } else if (latest.role === 'assistant') {
      // FOR CHATGPT: Use injected prompt if we're waiting for a response
      const effectivePrompt = (currentSiteKey === 'chatgpt' && waitingForResponse && injectedPrompt) 
        ? injectedPrompt 
        : lastPrompt;
      
      console.log(`[RTool] [Window ${windowIndex}] Assistant response detected, effectivePrompt:`, effectivePrompt ? effectivePrompt.substring(0, 50) : 'NULL');
      
      // Skip if we're already logging this response
      if (isLoggingResponse) {
        console.log('[RTool] Skipping: already logging');
        return;
      }
      
      // Skip if we've logged a response very recently (within 3 seconds)
      const timeSinceLastLog = Date.now() - lastLoggedResponseTime;
      if (lastLoggedResponseTime > 0 && timeSinceLastLog < 3000) {
        console.log(`[RTool] Skipping: logged another response ${timeSinceLastLog}ms ago`);
        return;
      }
      
      const currentTime = Date.now();
      
      // Update pending response if content changed
      if (latest.content !== pendingResponse) {
        console.log('[RTool] ✓ Detected new assistant response at', currentTime);
        pendingResponse = latest.content;
        lastResponseTime = currentTime;
        responseStableCount = 0; // Reset stability counter
      } else {
        // Same content as before - increment stability counter
        responseStableCount++;
        console.log(`[RTool] Response unchanged (stability count: ${responseStableCount}), checking completion`);
      }
      
      // Clear existing timer
      if (responseDebounceTimer) {
        clearTimeout(responseDebounceTimer);
      }
      
      // Check if response is complete
      const isComplete = isResponseComplete();
      
      // For Gemini, we need more checks to ensure we're not logging fragments
      const isGemini = currentSiteKey === 'gemini';
      const minResponseLength = isGemini ? 300 : 100; // More strict minimum length
      const isResponseSubstantial = pendingResponse && pendingResponse.length > minResponseLength;
      const isResponseStable = responseStableCount >= (isGemini ? 5 : 3); // Require more stability
      
      // Log immediately if we detect completion AND the response is substantial
      // For ChatGPT, we can trust the completion buttons, so we don't need to wait for stability
      console.log(`[RTool] [Window ${windowIndex}] Completion check: isComplete=${isComplete}, isSubstantial=${isResponseSubstantial} (len=${pendingResponse?.length}), stableCount=${responseStableCount}`);
      if (isComplete && isResponseSubstantial && (currentSiteKey === 'chatgpt' || responseStableCount >= 2)) {
        console.log('[RTool] Response complete (detected completion indicator), substantial, and stable enough');
        logCompletedResponse(pendingResponse);
      } 
      // Also log if response is VERY stable (seen multiple times unchanged) and substantial
      else if (isResponseStable && isResponseSubstantial) {
        console.log(`[RTool] Response very stable (${responseStableCount} unchanged observations) and substantial`);
        logCompletedResponse(pendingResponse);
      }
      else {
        // Wait much longer for Gemini responses
        const debounceTime = isGemini ? 15000 : 8000; // Longer initial debounce
        responseDebounceTimer = setTimeout(() => {
          if (pendingResponse && !isLoggingResponse) {
            // Double-check that no updates happened in the last 5 seconds
            const timeSinceLastUpdate = Date.now() - lastResponseTime;
            if (timeSinceLastUpdate >= 5000 && isResponseSubstantial) {
              console.log(`[RTool] Response complete (no changes for ${debounceTime/1000}s, stable for ${timeSinceLastUpdate/1000}s)`);
              
              // For Gemini, wait even longer for very short responses
              if (isGemini && pendingResponse.length < 500) {
                console.log('[RTool] Short Gemini response, waiting longer to ensure completion');
                // Set another timeout for short responses
                responseDebounceTimer = setTimeout(() => {
                  if (pendingResponse && !isLoggingResponse) {
                    // Only log if it's still the same response after additional wait
                    const finalTimeSinceUpdate = Date.now() - lastResponseTime;
                    if (finalTimeSinceUpdate >= 8000) {
                      console.log('[RTool] Short response stable for extended period, logging');
                      logCompletedResponse(pendingResponse);
                    }
                  }
                }, 5000);
              } else {
                // For longer responses or non-Gemini, log now
                logCompletedResponse(pendingResponse);
              }
            } else {
              console.log(`[RTool] Response still updating or not substantial, waiting longer`);
              // Set another timeout to check again later
              responseDebounceTimer = setTimeout(() => {
                if (pendingResponse && !isLoggingResponse && pendingResponse.length > minResponseLength) {
                  // Final check - only log if stable for at least 3 seconds
                  const finalTimeSinceUpdate = Date.now() - lastResponseTime;
                  if (finalTimeSinceUpdate >= 3000) {
                    console.log('[RTool] Final timeout reached, response stable, logging');
                    logCompletedResponse(pendingResponse);
                  } else {
                    console.log('[RTool] Response still changing at final timeout, not logging');
                  }
                }
              }, 8000);
            }
          }
        }, debounceTime);
      }
    }
  });

  conversationObserver.observe(targetNode, config);
  window.conversationObserver = conversationObserver;
  console.log('[RTool] Conversation monitoring started');
}

// Monitor user input submissions (for manual prompts not detected by DOM)
function setupUserInputMonitoring() {
  console.log('[RTool] Setting up user input monitoring for window:', windowIndex);
  
  // CRITICAL: For ChatGPT, DISABLE input monitoring - use DOM-based detection only
  // Input monitoring is unreliable for ChatGPT's dynamic UI
  if (currentSiteKey === 'chatgpt') {
    console.log('[RTool] ⚠️ SKIPPING input monitoring for ChatGPT - using DOM-based detection only');
    return;
  }

  // Find common input elements with broader selectors for all sites
  const inputSelectors = [
    // Standard input elements
    'textarea',
    'input[type="text"]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    
    // Editor-specific elements
    '.ql-editor',  // Quill editor
    '.ProseMirror',  // ProseMirror editor
    
    // Gemini-specific selectors
    '[class*="input-area"]',
    '[class*="prompt-area"]',
    '[class*="textarea"]',
    '[class*="input-box"]',
    '[class*="query-input"]',
    
    // ChatGPT-specific selectors
    '#prompt-textarea',
    '[data-id="root"]',
    '[data-id="chat-input"]',
    
    // Claude-specific selectors
    '[class*="claude"]',
    '[class*="chat-input"]',
    
    // Generic selectors that might catch inputs
    'form textarea',
    'form [contenteditable]',
    'form [role="textbox"]',
    'div[class*="input"]',
    'div[class*="composer"]'
  ];

  const inputElements = [];
  inputSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!inputElements.includes(el)) {
          inputElements.push(el);
        }
      });
    } catch (e) {
      console.warn(`[RTool] Error finding inputs with selector ${selector}:`, e);
    }
  });

  console.log(`[RTool] Found ${inputElements.length} potential input elements`);

  // If no input elements found, try a more aggressive approach
  if (inputElements.length === 0) {
    console.log('[RTool] No input elements found, trying broader approach');
    
    // Look for any element that might be an input container
    const possibleContainers = document.querySelectorAll('div[role="main"] div, main div, [class*="chat"] div');
    possibleContainers.forEach(container => {
      // Check if it looks like an input area (near bottom of page, has child inputs)
      const rect = container.getBoundingClientRect();
      const isNearBottom = rect.bottom > window.innerHeight - 300; // More generous bottom margin
      const hasInputLikeChildren = container.querySelector('textarea, [contenteditable], [role="textbox"]');
      
      if (isNearBottom && (hasInputLikeChildren || container.getAttribute('contenteditable') === 'true')) {
        inputElements.push(container);
        console.log('[RTool] Found potential input container:', container);
      }
    });
  }
  
  // CRITICAL: If we still have no input elements, add a global mutation observer
  // to watch for input elements that might be added dynamically
  if (inputElements.length === 0) {
    console.log('[RTool] No input elements found, setting up mutation observer for inputs');
    
    // Set up a mutation observer to watch for new input elements
    const inputObserver = new MutationObserver((mutations) => {
      let newInputsFound = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node is an input element
              if (node.tagName === 'TEXTAREA' || 
                  node.tagName === 'INPUT' ||
                  node.getAttribute('contenteditable') === 'true' ||
                  node.getAttribute('role') === 'textbox') {
                
                if (!inputElements.includes(node)) {
                  inputElements.push(node);
                  setupInputMonitoring(node);
                  newInputsFound = true;
                  console.log('[RTool] Found new input element via mutation:', node);
                }
              }
              
              // Also check children of added nodes
              const childInputs = node.querySelectorAll('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]');
              childInputs.forEach(input => {
                if (!inputElements.includes(input)) {
                  inputElements.push(input);
                  setupInputMonitoring(input);
                  newInputsFound = true;
                  console.log('[RTool] Found new child input element via mutation:', input);
                }
              });
            }
          });
        }
      });
      
      if (newInputsFound) {
        console.log(`[RTool] Updated input elements count: ${inputElements.length}`);
      }
    });
    
    // Start observing the document with the configured parameters
    inputObserver.observe(document.body, { childList: true, subtree: true });
    console.log('[RTool] Input mutation observer started');
  }

  // Set up document-wide monitoring for Gemini
  if (currentSiteKey === 'gemini') {
    console.log('[RTool] Setting up document-wide monitoring for Gemini');
    
    // Monitor all clicks on the document
    document.addEventListener('click', (event) => {
      // Look for click on or near send buttons
      const target = event.target;
      const isSendButton = 
        (target.tagName === 'BUTTON' && 
         (target.textContent?.toLowerCase().includes('send') || 
          target.getAttribute('aria-label')?.toLowerCase().includes('send'))) ||
        target.closest('button[aria-label*="send" i]') ||
        target.closest('button[title*="send" i]') ||
        target.closest('button[aria-label*="submit" i]');
      
      if (isSendButton) {
        console.log('[RTool] Send button clicked (document monitor)');
        
        // Find the closest input element
        const nearbyInputs = inputElements.filter(input => {
          const inputRect = input.getBoundingClientRect();
          const clickY = event.clientY;
          // Input should be above the click and within 200px vertically
          return inputRect.bottom < clickY && clickY - inputRect.bottom < 200;
        });
        
        if (nearbyInputs.length > 0) {
          // Use the closest input above the click
          const input = nearbyInputs[0];
          const inputText = getInputText(input);
          if (inputText && inputText.trim().length > 0) {
            console.log('[RTool] Captured manual prompt from document monitor:', inputText.substring(0, 50));
            captureManualPrompt(inputText.trim());
          }
        } else {
          console.log('[RTool] Send button clicked but no input found nearby');
        }
      }
    });
  }

  // Monitor each input element individually
  inputElements.forEach((input, index) => {
    console.log(`[RTool] Monitoring input ${index}:`, input.tagName, input.className);

    // Monitor for Enter key presses
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        console.log(`[RTool] [Window ${windowIndex}] Enter key detected in input`);
        console.log(`[RTool] [Window ${windowIndex}] blockManualPromptCapture flag at Enter time:`, window.blockManualPromptCapture);
        const inputText = getInputText(input);
        if (inputText && inputText.trim().length > 0) {
          console.log(`[RTool] [Window ${windowIndex}] Captured prompt from Enter key:`, inputText.substring(0, 50));
          captureManualPrompt(inputText.trim());
        }
      }
    });

    // Monitor for form submissions
    const form = input.closest('form');
    if (form) {
      form.addEventListener('submit', () => {
        console.log('[RTool] Form submission detected');
        const inputText = getInputText(input);
        if (inputText && inputText.trim().length > 0) {
          console.log('[RTool] Captured manual prompt from form:', inputText.substring(0, 50));
          captureManualPrompt(inputText.trim());
        }
      });
    }

    // Monitor for send button clicks near the input
    // Look more broadly for buttons - search parent, siblings, and nearby elements
    const parentElement = input.parentElement;
    const siblingElements = parentElement ? Array.from(parentElement.children) : [];
    const nearbyButtons = [];
    
    // Add buttons from parent
    if (parentElement) {
      const parentButtons = parentElement.querySelectorAll('button');
      parentButtons.forEach(btn => nearbyButtons.push(btn));
    }
    
    // Add buttons from siblings
    siblingElements.forEach(sibling => {
      if (sibling !== input) {
        const siblingButtons = sibling.querySelectorAll('button');
        siblingButtons.forEach(btn => nearbyButtons.push(btn));
      }
    });
    
    // Add buttons from next sibling container (common pattern)
    const nextContainer = parentElement?.nextElementSibling;
    if (nextContainer) {
      const nextButtons = nextContainer.querySelectorAll('button');
      nextButtons.forEach(btn => nearbyButtons.push(btn));
    }
    
    // Check all found buttons
    nearbyButtons.forEach(button => {
      const buttonText = button.textContent?.toLowerCase() || '';
      const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
      const title = button.getAttribute('title')?.toLowerCase() || '';
      
      // Check for send indicators
      const isSendButton = 
        buttonText.includes('send') || 
        ariaLabel.includes('send') || 
        title.includes('send') ||
        buttonText.includes('submit') || 
        ariaLabel.includes('submit') ||
        button.querySelector('svg') !== null; // Often send buttons have SVG icons
      
      if (isSendButton) {
        button.addEventListener('click', () => {
          console.log(`[RTool] [Window ${windowIndex}] Send button clicked near input`);
          console.log(`[RTool] [Window ${windowIndex}] blockManualPromptCapture flag at click time:`, window.blockManualPromptCapture);
          const inputText = getInputText(input);
          if (inputText && inputText.trim().length > 0) {
            console.log(`[RTool] [Window ${windowIndex}] Captured prompt from send button click:`, inputText.substring(0, 50));
            captureManualPrompt(inputText.trim());
          }
        });
      }
    });
  });
}

// Get text content from various input types
function getInputText(input) {
  // Handle null or undefined input
  if (!input) return '';
  
  try {
    // Standard form elements
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      return input.value || '';
    } 
    
    // ContentEditable elements
    if (input.getAttribute('contenteditable') === 'true') {
      return input.textContent || input.innerText || '';
    } 
    
    // Special editor components
    if (input.classList.contains('ql-editor') || 
        input.classList.contains('ProseMirror') || 
        input.getAttribute('role') === 'textbox') {
      return input.textContent || input.innerText || '';
    }
    
    // For Gemini, check for nested input elements
    if (currentSiteKey === 'gemini') {
      // Try to find nested textarea or contenteditable
      const nestedInput = input.querySelector('textarea, [contenteditable="true"], [role="textbox"]');
      if (nestedInput) {
        return nestedInput.value || nestedInput.textContent || nestedInput.innerText || '';
      }
      
      // For Gemini's complex input containers
      const possibleTextContainers = input.querySelectorAll('div, p, span');
      for (const container of possibleTextContainers) {
        const text = container.textContent || container.innerText;
        if (text && text.trim().length > 0) {
          return text;
        }
      }
    }
    
    // Fallback to any available text content
    return input.value || input.textContent || input.innerText || '';
  } catch (e) {
    console.error('[RTool] Error getting input text:', e);
    return '';
  }
}

// Capture a manual prompt for logging
function captureManualPrompt(promptText) {
  console.log(`[RTool] [Window ${windowIndex}] ========== captureManualPrompt called ==========`);
  console.log(`[RTool] [Window ${windowIndex}] Prompt text:`, promptText ? promptText.substring(0, 50) : 'NULL');
  console.log(`[RTool] [Window ${windowIndex}] blockManualPromptCapture flag:`, window.blockManualPromptCapture);
  
  // CRITICAL: If we're blocking manual capture due to an auto-prompt, still allow
  // capture when the prompt text is different from the injected auto-prompt.
  if (window.blockManualPromptCapture === true) {
    if (promptText && injectedPrompt && promptText !== injectedPrompt) {
      console.log(`[RTool] [Window ${windowIndex}] ⚠️ Manual capture unblocked for different prompt while auto pending`);
    } else {
      console.log(`[RTool] [Window ${windowIndex}] ⚠️ BLOCKED manual prompt capture - waiting for auto-prompt response`);
      console.log(`[RTool] [Window ${windowIndex}] Blocked prompt was:`, promptText.substring(0, 50));
      return;
    }
  }
  
  console.log(`[RTool] [Window ${windowIndex}] ✓ Manual prompt capture NOT blocked, proceeding...`);
  
  // Validate prompt text
  if (!promptText || typeof promptText !== 'string' || promptText.trim().length === 0) {
    console.log('[RTool] Invalid prompt text, skipping');
    return;
  }
  
  // Clean up the prompt text
  promptText = promptText.trim();
  
  // CRITICAL: Filter out garbage that looks like JavaScript code
  const isGarbage = (
    promptText.includes('window.__oai_') ||
    promptText.includes('Date.now') ||
    promptText.includes('requestAnimationFrame') ||
    (promptText.includes('window.') && promptText.includes('(')) ||
    promptText.includes('__oai_') ||
    promptText.includes('function(') ||
    promptText.includes('=>') ||
    promptText.includes('console.log')
  );
  
  if (isGarbage) {
    console.log('[RTool] ⚠️ BLOCKED manual prompt capture - detected garbage:', promptText.substring(0, 100));
    return;
  }
  
  // Check for very short prompts that might be UI elements
  if (promptText.length < 3) {
    console.log('[RTool] Prompt too short, likely not a real prompt:', promptText);
    return;
  }
  
  // For Window 1, be more lenient with duplicate detection
  // This is critical to ensure Window 1's manual prompts are captured
  if (windowIndex === 0 && promptText === lastPrompt) {
    // For Window 1, check how long it's been since we last captured this prompt
    const now = Date.now();
    const timeSinceLastCapture = now - (window.lastPromptCaptureTime || 0);
    
    // If it's been more than 10 seconds, allow recapturing the same prompt
    if (timeSinceLastCapture > 10000) {
      console.log('[RTool] Window 1 manual prompt unchanged but time threshold exceeded, capturing anyway');
    } else {
      console.log('[RTool] Window 1 manual prompt unchanged, skipping');
      return;
    }
  } else if (promptText === lastPrompt) {
    // Standard duplicate detection for other windows
    console.log('[RTool] Manual prompt unchanged, skipping');
    return;
  }

  // Prevent rapid duplicate captures - be more lenient for Window 1
  const now = Date.now();
  const minTimeBetweenCaptures = windowIndex === 0 ? 500 : 1000; // 0.5 seconds for Window 1, 1 second for others
  
  if (window.lastPromptCaptureTime && (now - window.lastPromptCaptureTime) < minTimeBetweenCaptures) {
    console.log(`[RTool] Manual prompt captured too recently (${now - window.lastPromptCaptureTime}ms), skipping`);
    return;
  }
  
  // Check if windowIndex is set
  if (windowIndex === null || windowIndex === undefined) {
    console.error('[RTool] Window index not set, cannot log manual prompt');
    // Try to recover by using a default window index
    windowIndex = 0;
  }
  
  console.log(`[RTool] Capturing manual prompt for Window ${windowIndex}: ${promptText.substring(0, 50)}...`);
  
  window.lastPromptCaptureTime = now;

  // Mark this prompt as captured by input monitoring
  window.lastCapturedPrompt = promptText;

  lastPrompt = promptText;
  console.log('[RTool] ✓ Captured manual prompt:', promptText.substring(0, 100));
  console.log('[RTool] Window index for this prompt:', windowIndex);

  // Reset response state for new prompt
  lastResponse = null;
  pendingResponse = null;
  isLoggingResponse = false;
  lastResponseTime = 0;

  if (responseDebounceTimer) {
    clearTimeout(responseDebounceTimer);
    responseDebounceTimer = null;
  }

  // Send to popup to create the entry with retry logic
  function sendManualPrompt(retryCount = 0) {
    // Add critical information to ensure proper logging
    const message = {
      action: 'manualPrompt',
      windowIndex: windowIndex,
      prompt: promptText,
      isManual: true, // Flag to ensure proper labeling
      timestamp: new Date().toISOString(),
      url: window.location.href, // Include the URL for better identification
      source: 'direct_input_capture', // Indicate this was captured directly from input
      manualOverride: true // Special flag to force manual prompt handling
    };
    
    console.log(`[RTool] [Window ${windowIndex}] Sending manual prompt message:`, message);
    
    chrome.runtime.sendMessage(message).then((response) => {
      console.log(`[RTool] [Window ${windowIndex}] ✓ Manual prompt sent successfully, response:`, response);
      
      // Force a DOM scan to ensure we capture the response
      setTimeout(() => {
        console.log(`[RTool] [Window ${windowIndex}] Forcing DOM scan after manual prompt`);
        const messages = extractConversationMessages();
        if (messages.length > 0) {
          console.log(`[RTool] [Window ${windowIndex}] Force scan found`, messages.length, 'messages');
        }
      }, 500);
    }).catch(err => {
      console.error(`[RTool] [Window ${windowIndex}] Failed to send manual prompt:`, err);
      
      // Retry with exponential backoff
      if (retryCount < 5) {
        const delay = Math.min(500 * Math.pow(1.5, retryCount), 5000); // Exponential backoff with 5s max
        console.log(`[RTool] [Window ${windowIndex}] Retrying manual prompt send (attempt ${retryCount + 1}) after ${delay}ms`);
        setTimeout(() => sendManualPrompt(retryCount + 1), delay);
      } else {
        console.error(`[RTool] [Window ${windowIndex}] Failed to send manual prompt after ${retryCount} retries`);
      }
    });
  }
  
  // Start the send process
  sendManualPrompt();
  
  // Also set a timer to check for responses after manual prompt
  setTimeout(() => {
    if (!isLoggingResponse && !pendingResponse) {
      console.log('[RTool] Setting up delayed scan for manual prompt response');
      const checkForResponse = () => {
        const messages = extractConversationMessages();
        const assistantMessages = messages.filter(m => m.role === 'assistant');
        if (assistantMessages.length > 0) {
          console.log('[RTool] Found assistant response in delayed scan');
        }
        
        // Keep checking for a while
        if (!isLoggingResponse && !pendingResponse) {
          setTimeout(checkForResponse, 2000);
        }
      };
      
      checkForResponse();
    }
  }, 2000);
}

// Check if response streaming is complete (config-driven)
function isResponseComplete() {
  if (!currentSiteConfig || !currentSiteConfig.detection) {
    console.log('[RTool] No site config, relying on debounce');
    return false;
  }

  const detection = currentSiteConfig.detection;

  // Check for "Stop" button (indicates still streaming)
  if (detection.stopButton) {
    const stopButton = document.querySelector(detection.stopButton);
    if (stopButton && stopButton.offsetParent !== null) { // Check if visible
      console.log('[RTool] Response incomplete: Stop button visible');
      return false;
    }
  }

  // Check for regenerate button (indicates complete for ChatGPT)
  if (detection.regenerateButton) {
    const regenerateButton = document.querySelector(detection.regenerateButton);
    if (regenerateButton && regenerateButton.offsetParent !== null) { // Check if visible
      console.log('[RTool] Response complete: Regenerate button visible');
      return true;
    }
  }

  // Check for streaming classes
  if (detection.streamingClasses && detection.streamingClasses.length > 0) {
    for (const className of detection.streamingClasses) {
      const indicators = document.querySelectorAll(`[class*="${className}"]`);
      if (indicators.length > 0) {
        // Check if any are visible
        const visibleIndicators = Array.from(indicators).filter(el => el.offsetParent !== null);
        if (visibleIndicators.length > 0) {
          console.log(`[RTool] Response incomplete: Found ${visibleIndicators.length} visible '${className}' indicators`);
          return false;
        }
      }
    }
  }

  // Check for completion buttons (Gemini) - multiple possible indicators
  if (detection.completionButtons && detection.completionButtons.length > 0) {
    const selector = detection.completionButtons.join(', ');
    const completionButtons = document.querySelectorAll(selector);
    const visibleButtons = Array.from(completionButtons).filter(btn => btn.offsetParent !== null);
    if (visibleButtons.length > 0) {
      console.log(`[RTool] Response complete: Found ${visibleButtons.length} visible completion buttons`);
      return true;
    }
  }

  // For Gemini specifically, check for additional completion indicators
  if (currentSiteKey === 'gemini') {
    // Look for feedback/like buttons that appear when response is complete
    const feedbackButtons = document.querySelectorAll('button[aria-label*="thumbs"], button[aria-label*="like"], button[aria-label*="dislike"]');
    if (feedbackButtons.length > 0) {
      console.log('[RTool] Response complete: Found feedback buttons');
      return true;
    }

    // Check if the response has been stable for a while (additional check)
    if (pendingResponse && pendingResponse.length > 100) {
      console.log('[RTool] Response appears substantial, checking for stability');
      // This will fall through to debounce logic
    }
  }

  // Default: assume incomplete (will rely on debounce)
  console.log('[RTool] Response status unknown, relying on debounce');
  return false;
}

// Log the completed response
function logCompletedResponse(responseText) {
  // Prevent concurrent calls
  if (isLoggingResponse) {
    console.log('[RTool] Already logging response, skipping duplicate call');
    return;
  }

  // Prevent duplicate logging of the exact same response
  if (lastResponse === responseText) {
    console.log('[RTool] Already logged this exact response, skipping');
    return;
  }
  
  // NEVER log pending responses
  if (responseText === '(pending)') {
    console.log('[RTool] Refusing to log "(pending)" placeholder');
    return;
  }
  
  // Enforce minimum response length - more strict for Gemini
  const minLength = currentSiteKey === 'gemini' ? 200 : 50;
  if (responseText.length < minLength) {
    console.log(`[RTool] Response too short (${responseText.length} < ${minLength} chars), skipping`);
    return;
  }
  
  // Check if this response is too similar to one we've already logged
  if (responseHistory.length > 0) {
    // AGGRESSIVE FRAGMENT DETECTION
    
    // 1. Check if this is a fragment of ANY previous response
    const isFragment = responseHistory.some(prevResponse => {
      // If this response is contained within a previous one (with 90% overlap)
      if (prevResponse.includes(responseText.substring(0, Math.floor(responseText.length * 0.9)))) {
        console.log('[RTool] Response is a fragment of a previous response (contained within)');
        return true;
      }
      
      // If a previous response is contained within this one (partial response)
      if (responseText.includes(prevResponse) && responseText.length > prevResponse.length) {
        console.log('[RTool] Previous response was a fragment of this one (partial)');
        // In this case, we'll allow this longer response to replace the shorter one
        // by removing the shorter one from history
        const index = responseHistory.indexOf(prevResponse);
        if (index !== -1) {
          responseHistory.splice(index, 1);
          console.log('[RTool] Removed shorter fragment from history');
        }
        return false;
      }
      
      return false;
    });
    
    if (isFragment) {
      console.log('[RTool] Skipping fragment');
      return;
    }
    
    // 2. Check for high similarity with any previous response
    const isTooSimilar = responseHistory.some(prevResponse => {
      // Calculate similarity ratio
      const longerLength = Math.max(prevResponse.length, responseText.length);
      const shorterLength = Math.min(prevResponse.length, responseText.length);
      const lengthRatio = shorterLength / longerLength;
      
      // If lengths are very close (within 10%) and content has substantial overlap
      if (lengthRatio > 0.9) {
        // Check for content overlap
        if (prevResponse.includes(responseText.substring(0, 100)) || 
            responseText.includes(prevResponse.substring(0, 100))) {
          console.log('[RTool] Response too similar to a previous one (>90% length match with content overlap)');
          return true;
        }
      }
      
      return false;
    });
    
    if (isTooSimilar) {
      console.log('[RTool] Skipping too similar response');
      return;
    }
  }

  isLoggingResponse = true;
  lastResponse = responseText;
  pendingResponse = null;
  lastLoggedResponseTime = Date.now();
  
  // Add to response history (keep only last 5)
  responseHistory.push(responseText);
  if (responseHistory.length > 5) {
    responseHistory.shift();
  }

  console.log('[RTool] ========================================');
  console.log(`[RTool] [Window ${windowIndex}] Logging response (length: ${responseText.length}):`, responseText.substring(0, 100) + '...');
  console.log(`[RTool] [Window ${windowIndex}] Current state: lastPrompt=${lastPrompt ? lastPrompt.substring(0, 30) : 'NULL'}, injectedPrompt=${injectedPrompt ? injectedPrompt.substring(0, 30) : 'NULL'}, waitingForResponse=${waitingForResponse}`);
  console.log(`[RTool] [Window ${windowIndex}] blockManualPromptCapture=${window.blockManualPromptCapture}`);
  console.log('[RTool] ========================================');

  // FOR CHATGPT: Use injected prompt if waiting; also tag source for disambiguation
  // FOR GEMINI: Use lastPrompt (normal DOM detection)
  let promptToUse = lastPrompt;
  let responseSource = 'unknown'; // 'auto' | 'manual'
  
  if (currentSiteKey === 'chatgpt') {
    if (injectedPrompt && waitingForResponse) {
      // Auto-prompt response
      promptToUse = injectedPrompt;
      responseSource = 'auto';
      console.log(`[RTool] [Window ${windowIndex}] [ChatGPT] Using injectedPrompt for auto-prompt response:`, promptToUse.substring(0, 50));
    } else if (lastPrompt && !lastPrompt.includes('window.__oai_')) {
      // Manual prompt response
      promptToUse = lastPrompt;
      responseSource = 'manual';
      console.log(`[RTool] [Window ${windowIndex}] [ChatGPT] Using lastPrompt for manual prompt response:`, promptToUse.substring(0, 50));
    } else {
      console.warn(`[RTool] [Window ${windowIndex}] [ChatGPT] ⚠️ No valid prompt available! lastPrompt=${lastPrompt ? lastPrompt.substring(0, 30) : 'NULL'}`);
    }
    
    // Clear the waiting flag now that we've classified/logged the response
    if (waitingForResponse) {
      waitingForResponse = false;
      window.waitingForResponse = false;
      console.log(`[RTool] [Window ${windowIndex}] [ChatGPT] Cleared waitingForResponse flag`);
    }
    
    // CRITICAL: Clear injectedPrompt after logging to prevent reuse for manual prompts
    if (injectedPrompt) {
      console.log(`[RTool] [Window ${windowIndex}] [ChatGPT] Clearing injectedPrompt to prevent reuse:`, injectedPrompt.substring(0, 30));
      injectedPrompt = null;
      window.injectedPrompt = null;
    }
    
    // Clear the manual prompt capture block now that the response is logged
    console.log(`[RTool] [Window ${windowIndex}] [ChatGPT] Checking blockManualPromptCapture flag: ${window.blockManualPromptCapture}`);
    if (window.blockManualPromptCapture) {
      window.blockManualPromptCapture = false;
      console.log(`[RTool] [Window ${windowIndex}] [ChatGPT] ✓ Unblocked manual prompt capture`);
    } else {
      console.log(`[RTool] [Window ${windowIndex}] [ChatGPT] Flag was already false, no need to unblock`);
    }
  }

  // If no promptToUse (manual detection failed), try to find a pending RTOOL entry
  if (!promptToUse) {
    console.log('[RTool] No promptToUse, looking for pending RTOOL entries...');
    // This will be handled by the background script's addLogEntry function
    // which can match responses to existing pending entries
  }

  console.log(`[RTool] [Window ${windowIndex}] Using prompt for logging:`, promptToUse ? promptToUse.substring(0, 50) : 'NULL (will match pending entries)');

  // Send to background for logging with retry
  function sendResponseLog(retryCount = 0) {
    const message = {
      action: 'logConversation',
      windowIndex: windowIndex,
      prompt: promptToUse,  // May be null for RTOOL responses
      response: lastResponse,
      timestamp: new Date().toISOString(),
      // Disambiguation flags for popup.js association logic
      isAuto: responseSource === 'auto',
      isManual: responseSource === 'manual'
    };
    
    console.log(`[RTool] [Window ${windowIndex}] Sending response log:`, {
      windowIndex: message.windowIndex,
      prompt: message.prompt ? message.prompt.substring(0, 30) : 'NULL',
      responseLength: message.response?.length
    });
    
    chrome.runtime.sendMessage(message).then((response) => {
      console.log(`[RTool] [Window ${windowIndex}] ✓ Response logged successfully, response:`, response);
      // Reset flag after a delay to allow for next response
      setTimeout(() => {
        isLoggingResponse = false;
      }, 3000); // Longer cooldown to prevent rapid duplicate logging
    }).catch(err => {
      console.error(`[RTool] [Window ${windowIndex}] ✗ Failed to log response:`, err);
      
      // Retry with exponential backoff
      if (retryCount < 3) {
        const delay = Math.min(500 * Math.pow(2, retryCount), 3000);
        console.log(`[RTool] [Window ${windowIndex}] Retrying response log (attempt ${retryCount + 1}) after ${delay}ms`);
        setTimeout(() => sendResponseLog(retryCount + 1), delay);
      } else {
        console.error(`[RTool] [Window ${windowIndex}] Failed to log response after ${retryCount} retries`);
        isLoggingResponse = false;
      }
    });
  }
  
  sendResponseLog();
}

function stopConversationMonitoring() {
  if (conversationObserver) {
    conversationObserver.disconnect();
    conversationObserver = null;
    window.conversationObserver = null;
  }
  if (responseDebounceTimer) {
    clearTimeout(responseDebounceTimer);
    responseDebounceTimer = null;
  }
  isMonitoring = false;
  window.isMonitoring = false;
  console.log('[RTool] Conversation monitoring stopped');
}

// Extract messages from the page using site-specific configuration
function extractConversationMessages() {
  console.log('[RTool] extractConversationMessages called, currentSiteConfig:', !!currentSiteConfig);

  // Special case for Gemini - use dedicated extraction
  if (currentSiteConfig && currentSiteKey === 'gemini') {
    console.log('[RTool] Using specialized Gemini extraction');
    try {
      // Dynamically load the Gemini extraction function
      if (typeof extractGeminiMessages === 'function') {
        const geminiMessages = extractGeminiMessages();
        if (geminiMessages && geminiMessages.length > 0) {
          console.log(`[RTool] Gemini extraction successful: ${geminiMessages.length} messages`);
          return geminiMessages;
        } else {
          console.log('[RTool] Gemini extraction returned 0 messages, trying fallback');
        }
      } else {
        console.error('[RTool] extractGeminiMessages function not found');
      }
    } catch (error) {
      console.error('[RTool] Error in Gemini extraction:', error);
    }
  }
  
  // Use config-driven extraction if available
  if (currentSiteConfig) {
    console.log(`[RTool] Using config for ${currentSiteConfig.name}`);
    const messages = extractConversationMessagesWithConfig(currentSiteConfig);
    if (messages && messages.length > 0) {
      console.log(`[RTool] Config extraction successful: ${messages.length} messages`);
      return messages;
    } else {
      console.log('[RTool] Config extraction failed (returned 0 messages), using fallback');
    }
  } else {
    console.log('[RTool] No site config available');
  }

  // Fallback to legacy extraction
  const legacyMessages = extractConversationMessagesLegacy();
  console.log(`[RTool] Legacy extraction: ${legacyMessages.length} messages`);
  return legacyMessages;
}

// Legacy extraction function (kept as fallback)
function extractConversationMessagesLegacy() {
  const messages = [];
  
  // Try ChatGPT format (data-message-author-role attribute)
  const chatGptMessages = document.querySelectorAll('[data-message-author-role]');
  if (chatGptMessages.length > 0) {
    console.log('[RTool] Using ChatGPT format, found', chatGptMessages.length, 'messages');
    chatGptMessages.forEach(msg => {
      const role = msg.getAttribute('data-message-author-role');
      const content = msg.querySelector('.markdown')?.innerText || 
                     msg.querySelector('[class*="text"]')?.innerText ||
                     msg.innerText;
      if (content && content.trim()) {
        messages.push({ role, content: content.trim() });
      }
    });
    return messages;
  }
  
  // Try Gemini format - multiple detection strategies
  // Strategy 1: Look for message-content divs (common in Gemini)
  const geminiMessages = document.querySelectorAll('[class*="message-content"], [class*="query-"], [class*="response-"], message-content');
  if (geminiMessages.length > 0) {
    console.log('[RTool] Using Gemini message-content format, found', geminiMessages.length, 'messages');
    geminiMessages.forEach(msg => {
      const parent = msg.parentElement;
      const text = msg.innerText?.trim();
      if (!text || text.length < 5) return;
      
      // Skip Gemini "thinking" sections (collapsible reasoning blocks and headers)
      const ariaLabel = msg.getAttribute('aria-label')?.toLowerCase() || '';
      const msgClass = msg.className?.toLowerCase() || '';
      const parentClass = parent?.className?.toLowerCase() || '';
      const combined = parentClass + ' ' + msgClass + ' ' + ariaLabel;
      
      // Also check text content for thinking indicators
      const textLower = text.toLowerCase();
      const thinkingKeywords = [
        'thinking', 'reasoning', 'analyzing', 'interpreting', 'pinpointing',
        'considering', 'evaluating', 'examining', 'assessing', 'sources'
      ];
      
      // Skip if it's a thinking section or a short header that matches thinking patterns
      const isThinkingHeader = text.length < 100 && thinkingKeywords.some(keyword => textLower.includes(keyword));
      const isThinkingSection = combined.includes('thinking') || 
          combined.includes('reasoning') || 
          combined.includes('analyzing') ||
          ariaLabel.includes('show thinking') ||
          msg.closest('[aria-label*="thinking"]') ||
          msg.closest('[class*="thinking"]');
      
      if (isThinkingSection || isThinkingHeader) {
        console.log('[RTool] Skipping Gemini thinking section/header:', text.substring(0, 50));
        return;
      }
      
      let role = 'assistant'; // Default to assistant
      if (combined.includes('user') || combined.includes('query')) {
        role = 'user';
      }
      
      messages.push({ role, content: text });
    });
    
    if (messages.length > 0) {
      console.log('[RTool] Extracted', messages.length, 'Gemini messages');
      return messages;
    }
  }
  
  // Strategy 2: Look for conversation containers with role indicators
  const geminiContainer = document.querySelector('[class*="conversation"], [class*="chat-history"], chat-window, main');
  if (geminiContainer) {
    console.log('[RTool] Found Gemini container:', geminiContainer.className);
    
    // Look for all child divs that might contain messages
    const allDivs = Array.from(geminiContainer.querySelectorAll('div'));
    const messageDivs = allDivs.filter(div => {
      const text = div.innerText?.trim();
      const hasChildren = div.children.length > 0;
      // Look for divs with substantial text content
      return text && text.length > 20 && text.length < 10000 && hasChildren;
    });
    
    console.log('[RTool] Found', messageDivs.length, 'potential message divs in Gemini');
    
    messageDivs.forEach(msg => {
      const classList = msg.className?.toLowerCase() || '';
      const ariaLabel = msg.getAttribute('aria-label')?.toLowerCase() || '';
      const text = msg.innerText?.trim();
      
      if (!text || text.length < 5) return;
      
      // Skip Gemini "thinking" sections and headers
      const textLower = text.toLowerCase();
      const thinkingKeywords = [
        'thinking', 'reasoning', 'analyzing', 'interpreting', 'pinpointing',
        'considering', 'evaluating', 'examining', 'assessing', 'sources'
      ];
      
      const isThinkingHeader = text.length < 100 && thinkingKeywords.some(keyword => textLower.includes(keyword));
      const isThinkingSection = classList.includes('thinking') || 
          classList.includes('reasoning') || 
          classList.includes('analyzing') ||
          ariaLabel.includes('thinking') ||
          ariaLabel.includes('show thinking') ||
          msg.closest('[aria-label*="thinking"]') ||
          msg.closest('[class*="thinking"]');
      
      if (isThinkingSection || isThinkingHeader) {
        console.log('[RTool] Skipping Gemini thinking section/header (Strategy 2):', text.substring(0, 50));
        return;
      }
      
      // Detect role from multiple signals
      let role = null;
      
      // Check class names
      if (classList.includes('user') || classList.includes('query') || ariaLabel.includes('user')) {
        role = 'user';
      } else if (classList.includes('model') || classList.includes('assistant') || 
                 classList.includes('bot') || classList.includes('response') ||
                 ariaLabel.includes('model') || ariaLabel.includes('assistant')) {
        role = 'assistant';
      }
      
      // Check data attributes
      if (!role) {
        const dataRole = msg.getAttribute('data-test-id') || msg.getAttribute('data-role') || '';
        if (dataRole.includes('user')) role = 'user';
        else if (dataRole.includes('model') || dataRole.includes('assistant')) role = 'assistant';
      }
      
      if (role) {
        messages.push({ role, content: text });
      }
    });
    
    if (messages.length > 0) {
      console.log('[RTool] Extracted', messages.length, 'messages from Gemini container');
      return messages;
    }
  }
  
  // Generic fallback: Look for conversation structure
  // Find the main content area (avoid headers, sidebars, etc.)
  const mainContent = document.querySelector('main, [role="main"], #main, .main-content') || document.body;
  
  // Get all potential message containers
  const potentialMessages = Array.from(mainContent.querySelectorAll('[class*="message"], [class*="chat"], [class*="response"], [class*="prompt"]'));
  
  // Filter to direct children of conversation containers
  const conversationContainers = mainContent.querySelectorAll('[class*="conversation"], [class*="chat"], [class*="thread"], [class*="messages"]');
  let messageElements = [];
  
  if (conversationContainers.length > 0) {
    conversationContainers.forEach(container => {
      const children = Array.from(container.children);
      messageElements = messageElements.concat(children.filter(el => {
        const text = el.innerText?.trim();
        return text && text.length > 10;
      }));
    });
  } else {
    messageElements = potentialMessages;
  }
  
  // Analyze message elements
  messageElements.forEach((msg, index) => {
    const text = msg.innerText?.trim();
    if (!text || text.length < 10) return;
    
    // Try to determine role
    const classList = msg.className.toLowerCase();
    const isUser = classList.includes('user') || 
                   msg.querySelector('[class*="user"]') ||
                   (index % 2 === 0); // Fallback: assume alternating user/assistant
    
    messages.push({
      role: isUser ? 'user' : 'assistant',
      content: text
    });
  });
  
  return messages;
}

// Debug function for DOM inspection (runs in content script context)
// Note: Due to CSP restrictions, we can't inject into page context
// This function can be triggered via chrome.tabs.sendMessage from popup
function debugDOM() {
  console.log('=== RTool DOM Debug ===');
  console.log('Current URL:', window.location.href);
  console.log('Site Key:', currentSiteKey);
  console.log('Site Config:', currentSiteConfig);
  
  console.log('\n--- Common ChatGPT Selectors ---');
  console.log('[data-message-author-role]:', document.querySelectorAll('[data-message-author-role]').length);
  console.log('[data-testid*="conversation-turn"]:', document.querySelectorAll('[data-testid*="conversation-turn"]').length);
  console.log('article[data-testid]:', document.querySelectorAll('article[data-testid]').length);
  console.log('.group.w-full:', document.querySelectorAll('.group.w-full').length);
  console.log('main:', document.querySelectorAll('main').length);
  
  const main = document.querySelector('main');
  if (main) {
    console.log('\n--- Main Element ---');
    console.log('Children count:', main.children.length);
    console.log('First 3 children:');
    for (let i = 0; i < Math.min(3, main.children.length); i++) {
      const child = main.children[i];
      console.log(`  ${i}: ${child.tagName}.${child.className}`);
      console.log(`     Attributes:`, Array.from(child.attributes).map(a => `${a.name}="${a.value}"`).join(' '));
      console.log(`     Text preview:`, child.innerText?.substring(0, 50));
    }
  }
  
  console.log('\n--- All elements with data-testid ---');
  const testIds = document.querySelectorAll('[data-testid]');
  const uniqueTestIds = new Set();
  testIds.forEach(el => {
    const testId = el.getAttribute('data-testid');
    uniqueTestIds.add(testId);
  });
  console.log('Unique data-testid values:', Array.from(uniqueTestIds).sort());
  
  console.log('\n--- Try extraction ---');
  if (currentSiteConfig) {
    const messages = extractConversationMessagesWithConfig(currentSiteConfig);
    console.log('Extracted messages:', messages);
  } else {
    console.log('No site config available');
  }
  
  console.log('\n======================');
}

console.log('[RTool] ========== CONTENT SCRIPT FULLY LOADED ==========');
console.log('[RTool] Content script is running in isolated context (normal for Chrome extensions)');
console.log('[RTool] To debug DOM, send a "debugDOM" message from background script');

