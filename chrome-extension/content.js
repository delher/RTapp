// Content script that runs in each opened window
// Handles prompt injection, transformation, and conversation monitoring

console.log('[RTool] Content script loaded');

// State for conversation monitoring
let conversationObserver = null;
let lastPrompt = null;
let lastResponse = null;
let windowIndex = null;
let isMonitoring = false;
let responseDebounceTimer = null;
let pendingResponse = null;
let isLoggingResponse = false; // Prevent concurrent logging

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'injectPrompt') {
    console.log('[RTool] Received inject prompt request');
    windowIndex = request.windowIndex;
    injectPrompt(request.prompt, request.transform).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'startMonitoring') {
    console.log('[RTool] Starting conversation monitoring');
    windowIndex = request.windowIndex;
    startConversationMonitoring();
    sendResponse({ success: true });
  } else if (request.action === 'stopMonitoring') {
    console.log('[RTool] Stopping conversation monitoring');
    stopConversationMonitoring();
    sendResponse({ success: true });
  }
});

// Inject and submit prompt
async function injectPrompt(rawPrompt, transform) {
  try {
    console.log('[RTool] Received transform:', transform);
    console.log('[RTool] Raw prompt:', rawPrompt);
    
    // Apply transform
    const prompt = applyTransform(rawPrompt, transform);
    console.log(`[RTool] Transformed prompt (${transform.category}:${transform.method}):`, prompt);
    
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

// Parseltongue transforms (same as Electron app)
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
  if (isMonitoring) return;
  isMonitoring = true;
  
  // Watch for new messages in the conversation
  const targetNode = document.body;
  const config = { childList: true, subtree: true };
  
  conversationObserver = new MutationObserver((mutations) => {
    // Look for new conversation items
    const messages = extractConversationMessages();
    if (messages.length > 0) {
      const latest = messages[messages.length - 1];
      
      // Check if it's a new prompt or response
      if (latest.role === 'user' && latest.content !== lastPrompt) {
        lastPrompt = latest.content;
        console.log('[RTool] Detected manual prompt:', lastPrompt);
        // Reset response state for new prompt
        lastResponse = null;
        pendingResponse = null;
        isLoggingResponse = false;
        if (responseDebounceTimer) {
          clearTimeout(responseDebounceTimer);
          responseDebounceTimer = null;
        }
      } else if (latest.role === 'assistant') {
        // Skip if we're already logging this response
        if (isLoggingResponse) {
          return;
        }
        
        // Skip if content hasn't changed
        if (latest.content === lastResponse || latest.content === pendingResponse) {
          return;
        }
        
        // Response is updating (streaming)
        pendingResponse = latest.content;
        
        // Clear existing timer
        if (responseDebounceTimer) {
          clearTimeout(responseDebounceTimer);
        }
        
        // Check if response is complete
        const isComplete = isResponseComplete();
        
        if (isComplete) {
          // Log immediately if we detect completion
          console.log('[RTool] Response complete (detected completion indicator)');
          logCompletedResponse(pendingResponse);
        } else {
          // Wait for streaming to stop (debounce)
          responseDebounceTimer = setTimeout(() => {
            if (pendingResponse && !isLoggingResponse) {
              console.log('[RTool] Response complete (no changes for 3s)');
              logCompletedResponse(pendingResponse);
            }
          }, 3000); // Wait 3 seconds after last change
        }
      }
    }
  });
  
  conversationObserver.observe(targetNode, config);
  console.log('[RTool] Conversation monitoring started');
}

// Check if response streaming is complete
function isResponseComplete() {
  // ChatGPT: Look for "Stop generating" button (present while streaming)
  const stopButton = document.querySelector('button[aria-label*="Stop" i]');
  if (stopButton) {
    return false; // Still streaming
  }
  
  // ChatGPT: Look for regenerate button (appears when done)
  const regenerateButton = document.querySelector('button[aria-label*="Regenerate" i]');
  if (regenerateButton) {
    return true; // Complete
  }
  
  // Look for other streaming indicators
  const streamingIndicators = document.querySelectorAll('[class*="streaming"], [class*="generating"]');
  if (streamingIndicators.length > 0) {
    return false; // Still streaming
  }
  
  // Default: assume incomplete (will rely on debounce)
  return false;
}

// Log the completed response
function logCompletedResponse(responseText) {
  // Prevent concurrent calls
  if (isLoggingResponse) {
    console.log('[RTool] Already logging, skipping duplicate');
    return;
  }
  
  // Prevent duplicate logging
  if (lastResponse === responseText) {
    console.log('[RTool] Already logged this exact response, skipping');
    return;
  }
  
  isLoggingResponse = true;
  lastResponse = responseText;
  pendingResponse = null;
  
  console.log('[RTool] Logging response (length:', responseText.length, '):', responseText.substring(0, 100) + '...');
  
  // Send to background for logging
  if (lastPrompt) {
    chrome.runtime.sendMessage({
      action: 'logConversation',
      windowIndex: windowIndex,
      prompt: lastPrompt,
      response: lastResponse,
      timestamp: new Date().toISOString()
    }).then(() => {
      console.log('[RTool] Response logged successfully');
      // Reset flag after a delay to allow for next response
      setTimeout(() => {
        isLoggingResponse = false;
      }, 1000);
    }).catch(err => {
      console.error('[RTool] Failed to log response:', err);
      isLoggingResponse = false;
    });
  } else {
    isLoggingResponse = false;
  }
}

function stopConversationMonitoring() {
  if (conversationObserver) {
    conversationObserver.disconnect();
    conversationObserver = null;
  }
  if (responseDebounceTimer) {
    clearTimeout(responseDebounceTimer);
    responseDebounceTimer = null;
  }
  isMonitoring = false;
  console.log('[RTool] Conversation monitoring stopped');
}

// Extract messages from the page (ChatGPT/ChatKit format)
function extractConversationMessages() {
  const messages = [];
  
  // Try ChatGPT format
  const chatGptMessages = document.querySelectorAll('[data-message-author-role]');
  chatGptMessages.forEach(msg => {
    const role = msg.getAttribute('data-message-author-role');
    const content = msg.querySelector('.markdown')?.innerText || 
                   msg.querySelector('[class*="text"]')?.innerText ||
                   msg.innerText;
    if (content && content.trim()) {
      messages.push({ role, content: content.trim() });
    }
  });
  
  // Try generic format (look for user/assistant patterns)
  if (messages.length === 0) {
    const allMessages = document.querySelectorAll('[class*="message"], [class*="chat"]');
    allMessages.forEach(msg => {
      const text = msg.innerText.trim();
      if (text.length > 10) { // Avoid empty/short elements
        // Heuristic: detect role based on styling or position
        const isUser = msg.querySelector('[class*="user"]') || 
                      msg.classList.contains('user');
        messages.push({ 
          role: isUser ? 'user' : 'assistant', 
          content: text 
        });
      }
    });
  }
  
  return messages;
}

