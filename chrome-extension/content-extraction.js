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

  // DEBUG: Log what we're looking for
  console.log(`[RTool] Message selectors:`, detection.messageSelectors);
  console.log(`[RTool] Container selectors:`, detection.containerSelectors);

  // Try message selectors array first (primary for Gemini)
  if (detection.messageSelectors && Array.isArray(detection.messageSelectors)) {
    const selector = detection.messageSelectors.join(', ');
    console.log(`[RTool] Trying message selector: ${selector}`);

    const messageElements = document.querySelectorAll(selector);
    console.log(`[RTool] Found ${messageElements.length} elements with message selectors`);

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
        console.log(`[RTool] Processing element ${index}: content length ${content?.length}`);

        if (!content || content.length < 5) {
          console.log(`[RTool] Skipping element ${index}: too short or empty`);
          return;
        }

        if (shouldSkipMessage(msg, content, filtering)) {
          console.log(`[RTool] Skipping element ${index}: filtered out`);
          return;
        }

        const role = detectRole(msg, detection.roleIndicators);
        console.log(`[RTool] Element ${index} detected role: ${role}`);

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

        if (shouldSkipMessage(msg, content, filtering)) {
          console.log(`[RTool] Container div ${index}: filtered out`);
          return;
        }

        const role = detectRole(msg, detection.roleIndicators);
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

        if (content && content.trim() && !shouldSkipMessage(msg, content, filtering)) {
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
  if (filtering.minResponseLength && content.length < filtering.minResponseLength) {
    console.log(`[RTool] Skipping response too short (${content.length} < ${filtering.minResponseLength}): "${content}"`);
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
