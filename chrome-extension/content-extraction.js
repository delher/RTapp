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
  const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
  const dataTestId = element.getAttribute('data-test-id')?.toLowerCase() || '';
  const combined = `${classList} ${ariaLabel} ${dataTestId}`;
  
  // Check user indicators
  if (roleIndicators.user) {
    for (const indicator of roleIndicators.user) {
      if (combined.includes(indicator)) return 'user';
    }
  }
  
  // Check assistant indicators
  if (roleIndicators.assistant) {
    for (const indicator of roleIndicators.assistant) {
      if (combined.includes(indicator)) return 'assistant';
    }
  }
  
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
  if (!filtering || !filtering.skipPatterns) return false;
  
  for (const pattern of filtering.skipPatterns) {
    if (pattern.type === 'class') {
      const classList = element.className?.toLowerCase() || '';
      for (const value of pattern.values) {
        if (classList.includes(value)) {
          console.log(`[RTool] Skipping message (class filter): ${content.substring(0, 50)}`);
          return true;
        }
      }
    }
    
    if (pattern.type === 'aria-label') {
      const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
      for (const value of pattern.values) {
        if (ariaLabel.includes(value)) {
          console.log(`[RTool] Skipping message (aria-label filter): ${content.substring(0, 50)}`);
          return true;
        }
      }
    }
    
    if (pattern.type === 'content' && pattern.keywords) {
      const textLower = content.toLowerCase();
      const maxLength = pattern.maxLength || 999999;
      
      if (content.length < maxLength) {
        for (const keyword of pattern.keywords) {
          if (textLower.includes(keyword)) {
            console.log(`[RTool] Skipping message (content filter): ${content.substring(0, 50)}`);
            return true;
          }
        }
      }
    }
  }
  
  // Check skip selectors (for parent elements)
  if (filtering.skipSelectors) {
    for (const selector of filtering.skipSelectors) {
      if (element.closest(selector)) {
        console.log(`[RTool] Skipping message (selector filter): ${content.substring(0, 50)}`);
        return true;
      }
    }
  }
  
  return false;
}

// Fallback extraction when no config or config fails
function extractConversationMessagesFallback() {
  const messages = [];
  
  // Try common patterns
  const commonSelectors = [
    '[data-message-author-role]',
    '[class*="message"]',
    '[class*="chat"]',
    '[data-testid*="message"]'
  ];
  
  for (const selector of commonSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`[RTool] Fallback found ${elements.length} messages with selector: ${selector}`);
      elements.forEach(el => {
        const content = el.innerText?.trim();
        if (content && content.length > 5) {
          messages.push({ role: 'assistant', content });
        }
      });
      
      if (messages.length > 0) {
        return messages;
      }
    }
  }
  
  console.warn('[RTool] Fallback extraction found no messages');
  return messages;
}

