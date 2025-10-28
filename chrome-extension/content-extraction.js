// Config-driven message extraction for different AI chat sites

function extractConversationMessagesWithConfig(siteConfig) {
  if (!siteConfig) {
    console.warn('[RTool] No site config available, using fallback extraction');
    return extractConversationMessagesFallback();
  }
  
  const messages = [];
  const detection = siteConfig.detection;
  const filtering = siteConfig.filtering;
  
  console.log(`[RTool] Using ${siteConfig.name} config for message extraction`);
  
  // Try primary message selector (e.g., ChatGPT, Claude)
  if (detection.messageSelector) {
    const messageElements = document.querySelectorAll(detection.messageSelector);
    if (messageElements.length > 0) {
      console.log(`[RTool] Found ${messageElements.length} messages using primary selector`);
      
      messageElements.forEach(msg => {
        // Get role
        let role = null;
        if (detection.roleAttribute) {
          role = msg.getAttribute(detection.roleAttribute);
        } else if (detection.roleIndicators) {
          role = detectRole(msg, detection.roleIndicators);
        }
        
        // Get content
        const content = extractContent(msg, detection.contentSelectors);
        
        if (content && content.trim() && !shouldSkipMessage(msg, content, filtering)) {
          messages.push({ role: role || 'assistant', content: content.trim() });
        }
      });
      
      if (messages.length > 0) {
        console.log(`[RTool] Extracted ${messages.length} messages`);
        return messages;
      }
    }
  }
  
  // Try message selectors array (e.g., Gemini Strategy 1)
  if (detection.messageSelectors && Array.isArray(detection.messageSelectors)) {
    const selector = detection.messageSelectors.join(', ');
    const messageElements = document.querySelectorAll(selector);
    
    if (messageElements.length > 0) {
      console.log(`[RTool] Found ${messageElements.length} messages using selectors array`);
      
      messageElements.forEach(msg => {
        const content = msg.innerText?.trim();
        if (!content || content.length < 5) return;
        
        if (shouldSkipMessage(msg, content, filtering)) return;
        
        const role = detectRole(msg, detection.roleIndicators);
        messages.push({ role: role || 'assistant', content });
      });
      
      if (messages.length > 0) {
        console.log(`[RTool] Extracted ${messages.length} messages`);
        return messages;
      }
    }
  }
  
  // Try container-based detection (e.g., Gemini Strategy 2)
  if (detection.containerSelectors) {
    const selector = Array.isArray(detection.containerSelectors) 
      ? detection.containerSelectors.join(', ')
      : detection.containerSelectors;
    const container = document.querySelector(selector);
    
    if (container) {
      console.log(`[RTool] Found container:`, container.tagName);
      
      const allDivs = Array.from(container.querySelectorAll('div'));
      const messageDivs = allDivs.filter(div => {
        const text = div.innerText?.trim();
        return text && text.length > 20 && text.length < 10000 && div.children.length > 0;
      });
      
      console.log(`[RTool] Found ${messageDivs.length} potential message divs`);
      
      messageDivs.forEach(msg => {
        const content = msg.innerText?.trim();
        if (!content || content.length < 5) return;
        
        if (shouldSkipMessage(msg, content, filtering)) return;
        
        const role = detectRole(msg, detection.roleIndicators);
        if (role) {
          messages.push({ role, content });
        }
      });
      
      if (messages.length > 0) {
        console.log(`[RTool] Extracted ${messages.length} messages from container`);
        return messages;
      }
    }
  }
  
  // Fallback to generic detection
  console.warn(`[RTool] ${siteConfig.name} config extraction failed, using fallback`);
  return extractConversationMessagesFallback();
}

// Detect role from element and config
function detectRole(element, roleIndicators) {
  if (!roleIndicators) return null;

  const classList = element.className?.toLowerCase() || '';
  const parentClass = element.parentElement?.className?.toLowerCase() || '';
  const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
  const dataTestId = element.getAttribute('data-test-id')?.toLowerCase() || '';
  const dataRole = element.getAttribute('data-role')?.toLowerCase() || '';
  const roleAttr = element.getAttribute('role')?.toLowerCase() || '';
  const combined = `${classList} ${parentClass} ${ariaLabel} ${dataTestId} ${dataRole} ${roleAttr}`;

  // Check user indicators
  if (roleIndicators.user) {
    for (const indicator of roleIndicators.user) {
      if (combined.includes(indicator.toLowerCase())) {
        console.log(`[RTool] Detected user role from indicator: ${indicator}`);
        return 'user';
      }
    }
  }

  // Check assistant indicators
  if (roleIndicators.assistant) {
    for (const indicator of roleIndicators.assistant) {
      if (combined.includes(indicator.toLowerCase())) {
        console.log(`[RTool] Detected assistant role from indicator: ${indicator}`);
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
function shouldSkipMessage(element, content, filtering) {
  if (!filtering) return false;
  
  // Check minimum response length (hard filter for very short responses)
  if (filtering.minResponseLength && content.length < filtering.minResponseLength) {
    console.log(`[RTool] Skipping message too short (${content.length} < ${filtering.minResponseLength}): ${content.substring(0, 50)}`);
    return true;
  }
  
  // Check minimum content length for short messages
  if (filtering.minContentLength && content.length < filtering.minContentLength) {
    // For short messages, be extra aggressive with filtering
    const textLower = content.toLowerCase();
    
    // Skip if it contains ANY thinking-related keyword
    const thinkingKeywords = [
      'thinking', 'reasoning', 'analyzing', 'interpreting', 'sources',
      'intent', 'noise', 'pattern', 'cipher', 'studies',
      'constructing', 'discovering', 'gathering', 'finalizing', 'draft', 'details', 'intel', 'knowledge'
    ];
    
    for (const keyword of thinkingKeywords) {
      if (textLower.includes(keyword)) {
        console.log(`[RTool] Skipping short message with keyword '${keyword}': ${content.substring(0, 50)}`);
        return true;
      }
    }
  }
  
  if (!filtering.skipPatterns) return false;
  
  for (const pattern of filtering.skipPatterns) {
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
    
    if (pattern.type === 'content' && pattern.keywords) {
      const textLower = content.toLowerCase();
      const maxLength = pattern.maxLength || 999999;
      
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
  }
  
  // Check skip selectors (for parent and ancestor elements)
  if (filtering.skipSelectors) {
    for (const selector of filtering.skipSelectors) {
      try {
        // Check element itself and all parents
        if (element.matches(selector) || element.closest(selector)) {
          console.log(`[RTool] Skipping message (selector filter '${selector}'): ${content.substring(0, 50)}`);
          return true;
        }
      } catch (e) {
        // Ignore selector errors
      }
    }
  }
  
  return false;
}

// Fallback extraction when no config or config fails
function extractConversationMessagesFallback() {
  const messages = [];
  
  // Try common patterns with proper role detection
  const commonSelectors = [
    { selector: '[data-message-author-role]', roleAttr: 'data-message-author-role' },
    { selector: '[class*="message"]', roleAttr: null },
    { selector: '[class*="chat"]', roleAttr: null },
    { selector: '[data-testid*="message"]', roleAttr: null }
  ];
  
  for (const config of commonSelectors) {
    const elements = document.querySelectorAll(config.selector);
    if (elements.length > 0) {
      console.log(`[RTool] Fallback found ${elements.length} messages with selector: ${config.selector}`);
      elements.forEach(el => {
        const content = el.innerText?.trim();
        if (!content || content.length < 10) return;
        
        // Determine role
        let role = 'assistant'; // Default
        if (config.roleAttr) {
          role = el.getAttribute(config.roleAttr) || 'assistant';
        } else {
          // Try to detect from class names
          const classList = el.className?.toLowerCase() || '';
          const dataAttrs = (el.getAttribute('data-test-id') || '').toLowerCase();
          if (classList.includes('user') || dataAttrs.includes('user')) {
            role = 'user';
          } else if (classList.includes('assistant') || classList.includes('model') || classList.includes('bot') ||
                     dataAttrs.includes('assistant') || dataAttrs.includes('model')) {
            role = 'assistant';
          }
        }
        
        messages.push({ role, content });
      });
      
      if (messages.length > 0) {
        console.log(`[RTool] Fallback extracted ${messages.length} messages`);
        return messages;
      }
    }
  }
  
  console.warn('[RTool] Fallback extraction found no messages');
  return messages;
}
