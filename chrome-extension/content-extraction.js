// Config-driven message extraction for different AI chat sites
// VERSION: 1.3.6 - Fixed isNewPrompt check order
//
// ARCHITECTURE NOTES:
// ===================
// This file handles SITE-SPECIFIC message extraction logic.
// It is responsible for:
//   1. Finding messages in the DOM based on site-specific selectors
//   2. Determining message roles (user vs assistant)
//   3. Filtering out unwanted content (thinking sections, UI elements, etc.)
//
// This file should NOT:
//   - Handle logging logic (that's in popup.js)
//   - Manage prompt/response association (that's in popup.js)
//   - Track window state (that's in content.js)
//
// Each site (ChatGPT, Gemini, Claude, Grok) has its own configuration
// in site-configs.js that defines how to extract messages.
//
// Changes to extraction logic for one site should NOT affect other sites.
// All site-specific logic should be isolated to the site's config.

function extractConversationMessagesWithConfig(siteConfig) {
  console.log('[RTool] 🔍 extractConversationMessagesWithConfig called - VERSION 1.3.8');
  console.log('[RTool] 🔍 Current URL:', window.location.href);
  console.log('[RTool] 🔍 Document ready state:', document.readyState);
  console.log('[RTool] 🔍 Body exists:', !!document.body);
  console.log('[RTool] 🔍 Main exists:', !!document.querySelector('main'));
  
  if (!siteConfig) {
    console.warn('[RTool] No site config available, using fallback extraction');
    return extractConversationMessagesFallback();
  }

  const messages = [];
  const detection = siteConfig.detection;
  const filtering = siteConfig.filtering;

  console.log(`[RTool] Using ${siteConfig.name} config for message extraction`);
  
  // DEBUG: Show what's actually on the page
  console.log(`[RTool] DOM DEBUG - Looking for common ChatGPT elements:`);
  console.log(`[RTool]   [data-message-author-role]:`, document.querySelectorAll('[data-message-author-role]').length);
  console.log(`[RTool]   article:`, document.querySelectorAll('article').length);
  console.log(`[RTool]   [data-testid]:`, document.querySelectorAll('[data-testid]').length);
  console.log(`[RTool]   .group:`, document.querySelectorAll('.group').length);
  console.log(`[RTool]   main:`, document.querySelectorAll('main').length);
  
  // CRITICAL DIAGNOSTIC: Show actual data-message-author-role values
  const roleElements = document.querySelectorAll('[data-message-author-role]');
  console.log(`[RTool]   Found ${roleElements.length} elements with data-message-author-role:`);
  roleElements.forEach((el, i) => {
    console.log(`[RTool]     ${i}: role="${el.getAttribute('data-message-author-role')}", content="${el.innerText?.substring(0, 50)}..."`);
  });
  
  // Show a sample of what's in main
  const main = document.querySelector('main');
  if (main) {
    console.log(`[RTool]   main has ${main.children.length} children`);
    console.log(`[RTool]   main first child:`, main.children[0]?.tagName, main.children[0]?.className);
  }

  // DEBUG: Log what we're looking for
  console.log(`[RTool] Message selectors:`, detection.messageSelectors);
  console.log(`[RTool] Container selectors:`, detection.containerSelectors);

  // Try message selectors array first (primary for Gemini)
  if (detection.messageSelectors && Array.isArray(detection.messageSelectors)) {
    const selector = detection.messageSelectors.join(', ');
    console.log(`[RTool] Trying message selector: ${selector}`);

    const messageElements = document.querySelectorAll(selector);
    console.log(`[RTool] Found ${messageElements.length} elements with message selectors`);
    
    // DEBUG: If no elements found, try each selector individually to see which ones work
    if (messageElements.length === 0) {
      console.log(`[RTool] No elements found with combined selector, trying individually...`);
      detection.messageSelectors.forEach(sel => {
        const elements = document.querySelectorAll(sel);
        console.log(`[RTool]   "${sel}" -> ${elements.length} elements`);
        if (elements.length > 0) {
          console.log(`[RTool]   First element:`, elements[0]);
        }
      });
    }

    // DEBUG: Log ALL found elements, even if we don't use them
    if (messageElements.length > 0) {
      console.log(`[RTool] ALL found elements:`);
      messageElements.forEach((msg, index) => {
        const content = msg.innerText?.trim();
        const classes = msg.className;
        const attrs = Array.from(msg.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ');
        console.log(`[RTool]   ${index}: ${msg.tagName}.${classes} ${attrs} | Content: "${content?.substring(0, 30)}..."`);
      });
    }

    if (messageElements.length > 0) {
      messageElements.forEach((msg, index) => {
        const content = msg.innerText?.trim();
        console.log(`[RTool] ====== Processing element ${index} ======`);
        console.log(`[RTool] Element ${index} tag: ${msg.tagName}, classes: ${msg.className}`);
        console.log(`[RTool] Element ${index} content length: ${content?.length}`);
        console.log(`[RTool] Element ${index} content preview: ${content?.substring(0, 80)}`);

        if (!content || content.length < 5) {
          console.log(`[RTool] Skipping element ${index}: too short or empty`);
          return;
        }

        // Detect role BEFORE filtering so we can apply role-specific filters
        let role = detectRole(msg, detection.roleIndicators);
        console.log(`[RTool] Element ${index} detectRole result: ${role}`);
        
        // If no role found, check if element has data-message-author-role attribute directly
        if (!role && msg.hasAttribute('data-message-author-role')) {
          role = msg.getAttribute('data-message-author-role');
          console.log(`[RTool] Element ${index} role from direct attribute: ${role}`);
        } else if (!role) {
          console.log(`[RTool] Element ${index} does NOT have data-message-author-role attribute`);
        }
        
        // If still no role, look for a child with the attribute
        if (!role) {
          const childWithRole = msg.querySelector('[data-message-author-role]');
          console.log(`[RTool] Element ${index} searching for child with [data-message-author-role]...`);
          if (childWithRole) {
            role = childWithRole.getAttribute('data-message-author-role');
            console.log(`[RTool] Element ${index} ✓ FOUND role from child attribute: ${role}`);
          } else {
            console.log(`[RTool] Element ${index} ✗ NO child with [data-message-author-role] found`);
          }
        }
        
        console.log(`[RTool] Element ${index} FINAL detected role: ${role}`);

        // Apply filtering with role information
        if (shouldSkipMessage(msg, content, filtering, role)) {
          console.log(`[RTool] Skipping element ${index}: filtered out`);
          return;
        }

        if (role) {
          messages.push({ role, content });
          console.log(`[RTool] Added message ${index}: ${role} (${content.length} chars)`);
        } else {
          console.log(`[RTool] Element ${index}: no role detected, skipping`);
        }
      });

            console.log(`[RTool] Final messages from selectors: ${messages.length}`);
            if (messages.length > 0) {
              return messages;
            } else {
              console.error(`[RTool] ⚠️ EXTRACTION FAILED: Found ${messageElements.length} elements but extracted 0 messages!`);
              console.error(`[RTool] This usually means all elements were filtered out or role detection failed`);
            }
    }
  }

  // Try container-based detection (fallback for Gemini)
  if (detection.containerSelectors) {
    const selector = Array.isArray(detection.containerSelectors)
      ? detection.containerSelectors.join(', ')
      : detection.containerSelectors;
    console.log(`[RTool] Trying container selector: ${selector}`);

    const container = document.querySelector(selector);
    console.log(`[RTool] Found container:`, container ? container.tagName : 'none');

    if (container) {
      const allDivs = Array.from(container.querySelectorAll('div'));
      console.log(`[RTool] Container has ${allDivs.length} divs total`);

      const messageDivs = allDivs.filter(div => {
        const text = div.innerText?.trim();
        const hasText = text && text.length > 20 && text.length < 10000;
        const hasChildren = div.children.length > 0;
        return hasText && hasChildren;
      });

      console.log(`[RTool] Found ${messageDivs.length} potential message divs`);

      messageDivs.forEach((msg, index) => {
        console.log(`[RTool] Checking div ${index}:`, msg.className, `(${msg.innerText?.length} chars)`);

        const content = msg.innerText?.trim();
        if (!content || content.length < 5) return;

        const role = detectRole(msg, detection.roleIndicators);
        
        if (shouldSkipMessage(msg, content, filtering, role)) {
          console.log(`[RTool] Container div ${index}: filtered out`);
          return;
        }
        console.log(`[RTool] Container div ${index}: role=${role}`);

        if (role) {
          messages.push({ role, content });
          console.log(`[RTool] Container: Added message ${role} (${content.length} chars)`);
        }
      });

      if (messages.length > 0) {
        console.log(`[RTool] Extracted ${messages.length} messages from container`);
        return messages;
      }
    }
  }

  // Try primary message selector (legacy)
  if (detection.messageSelector) {
    const messageElements = document.querySelectorAll(detection.messageSelector);
    if (messageElements.length > 0) {
      console.log(`[RTool] Found ${messageElements.length} messages using primary selector`);

      messageElements.forEach(msg => {
        let role = null;
        if (detection.roleAttribute) {
          role = msg.getAttribute(detection.roleAttribute);
        } else if (detection.roleIndicators) {
          role = detectRole(msg, detection.roleIndicators);
        }

        const content = extractContent(msg, detection.contentSelectors);

        if (content && content.trim() && !shouldSkipMessage(msg, content, filtering, role)) {
          messages.push({ role: role || 'assistant', content: content.trim() });
        }
      });

      if (messages.length > 0) {
        console.log(`[RTool] Extracted ${messages.length} messages using primary selector`);
        return messages;
      }
    }
  }

  // Fallback to generic detection
  // Only log as warning if we're in a conversation (URL contains /c/)
  const isConversationPage = window.location.href.includes('/c/');
  if (isConversationPage) {
    console.warn(`[RTool] ${siteConfig.name} config extraction failed, using fallback`);
  } else {
    console.log(`[RTool] ${siteConfig.name} config extraction returned 0 messages (page may not be ready yet)`);
  }
  return extractConversationMessagesFallback();
}

// Detect role from element and config
function detectRole(element, roleIndicators) {
  if (!roleIndicators) return null;

  // Method 1: Try selector-based matching (for things like [data-message-author-role="user"])
  if (roleIndicators.user) {
    for (const indicator of roleIndicators.user) {
      try {
        // If it looks like a CSS selector, try matching
        if (indicator.includes('[') || indicator.includes('.') || indicator.includes('#')) {
          if (element.matches(indicator) || element.closest(indicator)) {
            console.log(`[RTool] Detected user role from selector: ${indicator}`);
            return 'user';
          }
        }
      } catch (e) {
        // Not a valid selector, will try string matching below
      }
    }
  }

  if (roleIndicators.assistant) {
    for (const indicator of roleIndicators.assistant) {
      try {
        // If it looks like a CSS selector, try matching
        if (indicator.includes('[') || indicator.includes('.') || indicator.includes('#')) {
          if (element.matches(indicator) || element.closest(indicator)) {
            console.log(`[RTool] Detected assistant role from selector: ${indicator}`);
            return 'assistant';
          }
        }
      } catch (e) {
        // Not a valid selector, will try string matching below
      }
    }
  }

  // Method 2: Try string-based matching (for keywords like "user", "assistant")
  const classList = element.className?.toLowerCase() || '';
  const parentClass = element.parentElement?.className?.toLowerCase() || '';
  const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
  const dataTestId = element.getAttribute('data-test-id')?.toLowerCase() || '';
  const dataTestid = element.getAttribute('data-testid')?.toLowerCase() || '';
  const dataRole = element.getAttribute('data-role')?.toLowerCase() || '';
  const roleAttr = element.getAttribute('role')?.toLowerCase() || '';
  const dataMessageRole = element.getAttribute('data-message-author-role')?.toLowerCase() || '';
  const combined = `${classList} ${parentClass} ${ariaLabel} ${dataTestId} ${dataTestid} ${dataRole} ${roleAttr} ${dataMessageRole}`;

  // Check user indicators
  if (roleIndicators.user) {
    for (const indicator of roleIndicators.user) {
      const indicatorLower = indicator.toLowerCase();
      // Extract keyword from selector if needed (e.g., "user" from "[data-message-author-role='user']")
      const keyword = indicatorLower.match(/["']([^"']+)["']/)?.[1] || indicatorLower;
      
      if (combined.includes(keyword)) {
        console.log(`[RTool] Detected user role from indicator: ${indicator} (keyword: ${keyword})`);
        return 'user';
      }
    }
  }

  // Check assistant indicators
  if (roleIndicators.assistant) {
    for (const indicator of roleIndicators.assistant) {
      const indicatorLower = indicator.toLowerCase();
      // Extract keyword from selector if needed
      const keyword = indicatorLower.match(/["']([^"']+)["']/)?.[1] || indicatorLower;
      
      if (combined.includes(keyword)) {
        console.log(`[RTool] Detected assistant role from indicator: ${indicator} (keyword: ${keyword})`);
        return 'assistant';
      }
    }
  }

  // Fallback: check parent elements up to 3 levels
  let parent = element.parentElement;
  for (let i = 0; i < 3 && parent; i++) {
    const pClass = parent.className?.toLowerCase() || '';
    const pAria = parent.getAttribute('aria-label')?.toLowerCase() || '';
    const pData = parent.getAttribute('data-test-id')?.toLowerCase() || '';

    for (const indicator of roleIndicators.user) {
      if (pClass.includes(indicator) || pAria.includes(indicator) || pData.includes(indicator)) {
        console.log(`[RTool] Detected user role from parent indicator: ${indicator}`);
        return 'user';
      }
    }
    for (const indicator of roleIndicators.assistant) {
      if (pClass.includes(indicator) || pAria.includes(indicator) || pData.includes(indicator)) {
        console.log(`[RTool] Detected assistant role from parent indicator: ${indicator}`);
        return 'assistant';
      }
    }
    parent = parent.parentElement;
  }

  console.log(`[RTool] Could not detect role for element with classes: ${classList}`);
  return null;
}

// Extract content using selectors
function extractContent(element, selectors) {
  if (!selectors || selectors.length === 0) {
    return element.innerText;
  }
  
  for (const selector of selectors) {
    const contentEl = element.querySelector(selector);
    if (contentEl && contentEl.innerText?.trim()) {
      return contentEl.innerText.trim();
    }
  }
  
  return element.innerText;
}

// Check if message should be skipped based on filtering rules
function shouldSkipMessage(element, content, filtering, role = null) {
  if (!filtering) return false;

  // PRIORITY 1: Check skip selectors (structural filtering)
  // This is the most reliable way to identify thinking sections
  if (filtering.skipSelectors) {
    for (const selector of filtering.skipSelectors) {
      try {
        // Check element itself and all ancestors
        if (element.matches(selector) || element.closest(selector)) {
          console.log(`[RTool] Skipping message (structural filter '${selector}'): ${content.substring(0, 50)}`);
          return true;
        }
      } catch (e) {
        // Ignore invalid selectors
        console.warn(`[RTool] Invalid selector: ${selector}`);
      }
    }
  }

  // PRIORITY 2: Check minimum response length (hard filter)
  // IMPORTANT: Only apply to assistant responses, NOT user prompts
  // User prompts can be any length, even a single character like "?"
  if (role === 'assistant' && filtering.minResponseLength && content.length < filtering.minResponseLength) {
    console.log(`[RTool] Skipping assistant response too short (${content.length} < ${filtering.minResponseLength}): "${content}"`);
    return true;
  }

  // PRIORITY 3: Content-based filtering for remaining edge cases
  if (filtering.skipPatterns) {
    for (const pattern of filtering.skipPatterns) {
      if (pattern.type === 'content' && pattern.keywords) {
        const textLower = content.toLowerCase();
        const maxLength = pattern.maxLength || 999999;

        // Only check content filtering for short messages
        if (content.length <= maxLength) {
          for (const keyword of pattern.keywords) {
            const keywordLower = keyword.toLowerCase();
            if (textLower.includes(keywordLower)) {
              console.log(`[RTool] Skipping message (content filter '${keyword}'): ${content.substring(0, 50)}`);
              return true;
            }
          }
        }
      }

      if (pattern.type === 'class') {
        const classList = element.className?.toLowerCase() || '';
        const parentClass = element.parentElement?.className?.toLowerCase() || '';
        const combined = classList + ' ' + parentClass;

        for (const value of pattern.values) {
          if (combined.includes(value)) {
            console.log(`[RTool] Skipping message (class filter '${value}'): ${content.substring(0, 50)}`);
            return true;
          }
        }
      }

      if (pattern.type === 'aria-label') {
        const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
        const parentLabel = element.parentElement?.getAttribute('aria-label')?.toLowerCase() || '';
        const combined = ariaLabel + ' ' + parentLabel;

        for (const value of pattern.values) {
          if (combined.includes(value)) {
            console.log(`[RTool] Skipping message (aria-label filter '${value}'): ${content.substring(0, 50)}`);
            return true;
          }
        }
      }
    }
  }

  // PRIORITY 4: Minimum content length filtering
  if (filtering.minContentLength && content.length < filtering.minContentLength) {
    const textLower = content.toLowerCase();

    // For very short messages, check for thinking indicators
    const thinkingIndicators = ['thinking', 'analyzing', 'processing', 'working'];
    for (const indicator of thinkingIndicators) {
      if (textLower.includes(indicator)) {
        console.log(`[RTool] Skipping short thinking message: ${content.substring(0, 50)}`);
        return true;
      }
    }
  }

  return false;
}

// Fallback extraction when no config or config fails
function extractConversationMessagesFallback() {
  const messages = [];
  
  console.log('[RTool] Starting fallback extraction');
  
  // Try common patterns with proper role detection
  const commonSelectors = [
    // ChatGPT specific
    { selector: '[data-message-author-role]', roleAttr: 'data-message-author-role' },
    { selector: 'article[data-testid]', roleAttr: null },
    { selector: '[data-testid*="conversation-turn"]', roleAttr: null },
    { selector: '.group.w-full', roleAttr: null },
    // Generic patterns
    { selector: '[class*="message"]', roleAttr: null },
    { selector: '[class*="chat"]', roleAttr: null },
    { selector: '[data-testid*="message"]', roleAttr: null },
    { selector: 'div[class*="turn"]', roleAttr: null }
  ];
  
  for (const config of commonSelectors) {
    try {
      const elements = document.querySelectorAll(config.selector);
      if (elements.length > 0) {
        console.log(`[RTool] Fallback found ${elements.length} elements with selector: ${config.selector}`);
        
        elements.forEach((el, index) => {
          const content = el.innerText?.trim();
          if (!content || content.length < 10) {
            console.log(`[RTool] Fallback: Skipping element ${index} (too short or empty)`);
            return;
          }
          
          // Filter out JavaScript code and UI garbage
          const looksLikeCode = (content.includes('window.') && content.includes('(')) ||
                                (content.includes('window.') && content.includes('function')) ||
                                (content.includes('__oai_')) ||
                                (content.includes('Date.now')) ||
                                (content.includes('requestAnimationFrame'));
          
          if (looksLikeCode) {
            console.log(`[RTool] Fallback: Skipping element ${index} (looks like code):`, content.substring(0, 100));
            return;
          }
          
          // Filter out common UI elements
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
            'limit for GPT'
          ];
          
          const contentLower = content.toLowerCase();
          const isUIElement = uiPatterns.some(pattern => contentLower.includes(pattern.toLowerCase()));
          
          if (isUIElement) {
            console.log(`[RTool] Fallback: Skipping element ${index} (UI element):`, content.substring(0, 100));
            return;
          }
          
          // Determine role
          let role = null;
          
          // Method 1: Use role attribute if available
          if (config.roleAttr) {
            role = el.getAttribute(config.roleAttr);
            console.log(`[RTool] Fallback: Element ${index} role from attribute: ${role}`);
          }
          
          // Method 2: Check element and parent attributes/classes
          if (!role) {
            const classList = el.className?.toLowerCase() || '';
            const dataTestId = (el.getAttribute('data-testid') || '').toLowerCase();
            const dataId = (el.getAttribute('data-id') || '').toLowerCase();
            const parentClass = el.parentElement?.className?.toLowerCase() || '';
            const combined = `${classList} ${dataTestId} ${dataId} ${parentClass}`;
            
            console.log(`[RTool] Fallback: Element ${index} combined attributes: ${combined.substring(0, 100)}`);
            
            if (combined.includes('user')) {
              role = 'user';
            } else if (combined.includes('assistant') || combined.includes('model') || 
                       combined.includes('bot') || combined.includes('agent') ||
                       combined.includes('ai')) {
              role = 'assistant';
            }
          }
          
          // Method 3: Alternating pattern (user, assistant, user, assistant...)
          if (!role) {
            role = messages.length % 2 === 0 ? 'user' : 'assistant';
            console.log(`[RTool] Fallback: Element ${index} role from alternating pattern: ${role}`);
          }
          
          console.log(`[RTool] Fallback: Adding message ${index} as ${role} (${content.length} chars)`);
          messages.push({ role, content });
        });
        
        if (messages.length > 0) {
          console.log(`[RTool] Fallback extracted ${messages.length} messages`);
          return messages;
        }
      }
    } catch (e) {
      console.warn(`[RTool] Fallback selector failed: ${config.selector}`, e);
    }
  }
  
  // Only log as warning if we're in a conversation page
  const isConversationPage = window.location.href.includes('/c/');
  if (isConversationPage) {
    console.warn('[RTool] Fallback extraction found no messages');
  } else {
    console.log('[RTool] Fallback extraction found no messages (page may not be ready yet)');
  }
  return messages;
}

// Global debugging function - call from console with: rtoolDebugDOM()
window.rtoolDebugDOM = function() {
  console.log('=== RTool DOM Debug ===');
  console.log('Common selectors:');
  console.log('  [data-message-author-role]:', document.querySelectorAll('[data-message-author-role]').length);
  console.log('  article:', document.querySelectorAll('article').length);
  console.log('  [data-testid]:', document.querySelectorAll('[data-testid]').length);
  console.log('  [data-testid*="conversation"]:', document.querySelectorAll('[data-testid*="conversation"]').length);
  console.log('  .group:', document.querySelectorAll('.group').length);
  console.log('  .group.w-full:', document.querySelectorAll('.group.w-full').length);
  
  console.log('\nAll data-testid values:');
  const testIds = new Set();
  document.querySelectorAll('[data-testid]').forEach(el => {
    testIds.add(el.getAttribute('data-testid'));
  });
  testIds.forEach(id => console.log('  -', id));
  
  console.log('\nMain structure:');
  const main = document.querySelector('main');
  if (main) {
    console.log('  main exists with', main.children.length, 'children');
    Array.from(main.children).slice(0, 5).forEach((child, i) => {
      console.log(`  Child ${i}:`, child.tagName, child.className, 'data-testid:', child.getAttribute('data-testid'));
    });
  }
  
  console.log('\nSample message elements:');
  const sampleSelectors = [
    '[data-message-author-role="user"]',
    '[data-message-author-role="assistant"]',
    'article',
    '.group.w-full'
  ];
  sampleSelectors.forEach(sel => {
    const elements = document.querySelectorAll(sel);
    if (elements.length > 0) {
      console.log(`  ${sel}: ${elements.length} found`);
      console.log('    First element:', elements[0]);
      console.log('    Text preview:', elements[0].innerText?.substring(0, 100));
    }
  });
  
  console.log('======================');
};

console.log('[RTool] Debug function available: rtoolDebugDOM()');

