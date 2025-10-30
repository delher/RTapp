// Specialized extraction for Gemini chat interface
// This file contains Gemini-specific selectors and extraction logic

/**
 * Extracts conversation messages from Gemini's interface
 * Focuses on accurately identifying:
 * 1. User prompts (both RTool-injected and manually entered)
 * 2. Complete AI responses (filtering out thinking/reasoning phases)
 * 
 * @returns {Array} Array of message objects with role and content
 */
function extractGeminiMessages() {
  console.log('[RTool Gemini] Starting specialized Gemini extraction');
  const messages = [];

  // STEP 1: Extract user messages (highest priority)
  const userMessages = extractUserMessages();
  if (userMessages.length > 0) {
    console.log(`[RTool Gemini] Found ${userMessages.length} user messages`);
    messages.push(...userMessages);
  } else {
    console.log('[RTool Gemini] No user messages found');
  }

  // STEP 2: Extract assistant responses
  const assistantMessages = extractAssistantResponses();
  if (assistantMessages.length > 0) {
    console.log(`[RTool Gemini] Found ${assistantMessages.length} assistant messages`);
    messages.push(...assistantMessages);
  } else {
    console.log('[RTool Gemini] No assistant messages found');
  }

  // Sort messages by their position in the DOM to maintain conversation order
  const sortedMessages = sortMessagesByDOMPosition(messages);
  console.log(`[RTool Gemini] Extracted ${sortedMessages.length} total messages`);
  
  return sortedMessages;
}

/**
 * Extract user messages from Gemini's interface
 */
function extractUserMessages() {
  const messages = [];
  
  // User message selectors (in order of reliability)
  const userSelectors = [
    // Primary selectors - most reliable for user messages
    '[data-user-message="true"]',
    '[data-test-id*="user"]',
    '[data-query-id]',
    '.query-content',
    '.user-message',
    '.human-message',
    
    // Secondary selectors - check class names
    '[class*="user-message"]',
    '[class*="human-message"]',
    '[class*="query-content"]',
    
    // Tertiary selectors - look for user indicators
    '[class*="user"]',
    '[class*="query"]',
    '[class*="prompt"]',
    '[class*="input-area"] + div'
  ];
  
  // Try each selector
  for (const selector of userSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`[RTool Gemini] Found ${elements.length} potential user messages with selector: ${selector}`);
        
        elements.forEach(element => {
          // Extract text content
          const content = element.innerText?.trim();
          if (!content || content.length < 3) return;
          
          // Skip elements that look like buttons or UI controls
          if (element.tagName === 'BUTTON' || 
              element.getAttribute('role') === 'button' || 
              element.querySelector('button')) {
            return;
          }
          
          // Skip elements with very short content that might be labels
          if (content.length < 10 && (content.includes(':') || content.includes('?'))) {
            return;
          }
          
          // Store element reference for DOM position sorting
          messages.push({
            role: 'user',
            content: content,
            element: element,
            position: getDOMPosition(element)
          });
          
          console.log(`[RTool Gemini] Found user message: ${content.substring(0, 50)}...`);
        });
      }
    } catch (e) {
      console.warn(`[RTool Gemini] Error with selector ${selector}:`, e);
    }
  }
  
  // If no messages found with specific selectors, try a more general approach
  if (messages.length === 0) {
    console.log('[RTool Gemini] Trying general approach for user messages');
    
    // Look for conversation container
    const container = document.querySelector('[class*="conversation"], [class*="chat-history"], main');
    if (container) {
      // Find alternating messages (often user is even-indexed)
      const messageGroups = container.querySelectorAll('[class*="message-group"], [class*="turn"], [class*="exchange"]');
      if (messageGroups.length > 0) {
        messageGroups.forEach((group, index) => {
          // In many chat UIs, even-indexed groups are user messages
          if (index % 2 === 0) {
            const content = group.innerText?.trim();
            if (content && content.length > 3) {
              messages.push({
                role: 'user',
                content: content,
                element: group,
                position: getDOMPosition(group)
              });
            }
          }
        });
      }
    }
  }
  
  return messages;
}

/**
 * Extract assistant responses from Gemini's interface
 */
function extractAssistantResponses() {
  const messages = [];
  
  // Response message selectors (in order of reliability)
  const responseSelectors = [
    // Primary selectors - most reliable
    '[data-response-id]',
    '[data-test-id*="model"]',
    '[data-test-id*="assistant"]',
    '.model-response',
    '.assistant-message',
    '.gemini-response',
    
    // Secondary selectors - check class names
    '[class*="model-response"]',
    '[class*="assistant-message"]',
    '[class*="gemini-response"]',
    
    // Tertiary selectors - look for assistant indicators
    '[class*="model"]',
    '[class*="assistant"]',
    '[class*="response"]'
  ];
  
  // Try each selector
  for (const selector of responseSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`[RTool Gemini] Found ${elements.length} potential responses with selector: ${selector}`);
        
        elements.forEach(element => {
          // Skip if this is a thinking/reasoning section
          if (shouldSkipThinkingSection(element)) {
            return;
          }
          
          // Extract text content
          const content = element.innerText?.trim();
          if (!content || content.length < 10) return;
          
          // Skip short thinking indicators
          if (isThinkingIndicator(content)) {
            console.log(`[RTool Gemini] Skipping thinking indicator: ${content}`);
            return;
          }
          
          // Store element reference for DOM position sorting
          messages.push({
            role: 'assistant',
            content: content,
            element: element,
            position: getDOMPosition(element)
          });
          
          console.log(`[RTool Gemini] Found assistant response: ${content.substring(0, 50)}...`);
        });
      }
    } catch (e) {
      console.warn(`[RTool Gemini] Error with selector ${selector}:`, e);
    }
  }
  
  // If no messages found with specific selectors, try a more general approach
  if (messages.length === 0) {
    console.log('[RTool Gemini] Trying general approach for assistant responses');
    
    // Look for conversation container
    const container = document.querySelector('[class*="conversation"], [class*="chat-history"], main');
    if (container) {
      // Find alternating messages (often assistant is odd-indexed)
      const messageGroups = container.querySelectorAll('[class*="message-group"], [class*="turn"], [class*="exchange"]');
      if (messageGroups.length > 0) {
        messageGroups.forEach((group, index) => {
          // In many chat UIs, odd-indexed groups are assistant messages
          if (index % 2 === 1) {
            const content = group.innerText?.trim();
            if (content && content.length > 10 && !isThinkingIndicator(content)) {
              messages.push({
                role: 'assistant',
                content: content,
                element: group,
                position: getDOMPosition(group)
              });
            }
          }
        });
      }
    }
  }
  
  return messages;
}

/**
 * Check if an element is a thinking/reasoning section that should be skipped
 */
function shouldSkipThinkingSection(element) {
  // Check element attributes
  const classList = element.className?.toLowerCase() || '';
  const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
  const dataAttrs = Array.from(element.attributes)
    .filter(attr => attr.name.startsWith('data-'))
    .map(attr => attr.value.toLowerCase())
    .join(' ');
  
  // Combined text to check
  const combined = `${classList} ${ariaLabel} ${dataAttrs}`;
  
  // Check for thinking indicators in attributes
  const thinkingIndicators = [
    'thinking', 'reasoning', 'analyzing', 'interpreting',
    'considering', 'evaluating', 'examining', 'exploring',
    'investigating', 'processing', 'working', 'searching',
    'draft', 'interim', 'progress'
  ];
  
  for (const indicator of thinkingIndicators) {
    if (combined.includes(indicator)) {
      console.log(`[RTool Gemini] Skipping thinking section (${indicator})`);
      return true;
    }
  }
  
  // Check for structural indicators
  const skipSelectors = [
    '[aria-expanded="false"]',
    '[data-collapsed="true"]',
    'details:not([open])',
    '.thinking-section',
    '.reasoning-block',
    '[class*="progress"]',
    '[class*="loading"]',
    '[class*="spinner"]'
  ];
  
  for (const selector of skipSelectors) {
    try {
      if (element.matches(selector) || element.closest(selector)) {
        console.log(`[RTool Gemini] Skipping section matching ${selector}`);
        return true;
      }
    } catch (e) {
      // Ignore invalid selectors
    }
  }
  
  return false;
}

/**
 * Check if content text is a thinking indicator that should be skipped
 */
function isThinkingIndicator(content) {
  if (!content) return false;
  
  // Skip very short messages (likely to be thinking headers)
  // For Gemini, any message under 100 chars that contains thinking keywords is likely a header
  if (content.length < 100) {
    const textLower = content.toLowerCase();
    
    // Common thinking/processing phrases
    const thinkingPhrases = [
      'thinking', 'reasoning', 'analyzing', 'interpreting',
      'considering', 'evaluating', 'examining', 'exploring',
      'investigating', 'processing', 'working', 'searching',
      'finding', 'locating', 'identifying', 'seeking',
      'constructing', 'gathering', 'finalizing', 'preparing',
      'compiling', 'assembling', 'building', 'draft',
      'details', 'intel', 'knowledge', 'information',
      'just a sec', 'one moment', 'please wait',
      'pinpointing', 'discovering', 'finalizing',
      'deciphering', 'query', 'intent', 'request',
      'understanding', 'interpreting', 'parsing'
    ];
    
    for (const phrase of thinkingPhrases) {
      if (textLower.includes(phrase)) {
        return true;
      }
    }
    
    // Check for common Gemini thinking header patterns
    const headerPatterns = [
      /^[A-Z][a-z]+ [A-Z][a-z]+$/,  // Two capitalized words (e.g., "Constructing Response")
      /^[A-Z][a-z]+ [a-z]+ [A-Z][a-z]+$/,  // Pattern like "Gathering more information"
      /^[A-Z][a-z]+ [a-z]+ [a-z]+$/,  // Pattern like "Analyzing the query"
      /^[A-Z][a-z]+ [a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/  // Pattern like "Interpreting your request"
    ];
    
    for (const pattern of headerPatterns) {
      if (pattern.test(content.trim())) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get the DOM position of an element for sorting
 * Returns an array of indices representing the path from root to element
 */
function getDOMPosition(element) {
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    const parent = current.parentElement;
    if (!parent) break;
    
    const index = Array.from(parent.children).indexOf(current);
    path.unshift(index); // Add to beginning of array
    current = parent;
  }
  
  return path;
}

/**
 * Sort messages by their position in the DOM to maintain conversation order
 */
function sortMessagesByDOMPosition(messages) {
  // First remove the DOM element references and positions
  const cleanedMessages = messages.map(msg => {
    const { element, position, ...rest } = msg;
    return rest;
  });
  
  // Sort by DOM position
  messages.sort((a, b) => {
    const posA = a.position || [];
    const posB = b.position || [];
    
    // Compare each level of the path
    for (let i = 0; i < Math.min(posA.length, posB.length); i++) {
      if (posA[i] !== posB[i]) {
        return posA[i] - posB[i];
      }
    }
    
    // If one path is a prefix of the other, the shorter one comes first
    return posA.length - posB.length;
  });
  
  return cleanedMessages;
}

// Export the function for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractGeminiMessages };
}
