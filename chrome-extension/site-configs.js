// Site-specific configurations for different AI chat platforms
// Each config defines how to detect and extract messages for logging

const SITE_CONFIGS = {
  'chatgpt': {
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    detection: {
      // Primary detection method
      messageSelector: '[data-message-author-role]',
      roleAttribute: 'data-message-author-role',
      contentSelectors: ['.markdown', '[class*="text"]'],
      
      // Completion detection
      stopButton: 'button[aria-label*="Stop" i]',
      regenerateButton: 'button[aria-label*="Regenerate" i]',
      streamingClasses: ['streaming', 'generating']
    },
    filtering: {
      // No special filtering needed for ChatGPT
      skipPatterns: []
    }
  },
  
  'gemini': {
    name: 'Gemini',
    url: 'https://gemini.google.com/',
    detection: {
      // Multiple detection strategies - more flexible selectors
      messageSelectors: [
        '[class*="message"]',
        '[class*="query"]',
        '[class*="response"]',
        '[data-message-id]',
        '[role="row"]',
        '.message',
        '.query',
        '.response',
        'message-content'
      ],
      containerSelectors: [
        '[class*="conversation"]',
        '[class*="chat"]',
        '[class*="thread"]',
        'main',
        '[role="main"]',
        '.conversation',
        '.chat-history',
        'chat-window'
      ],
      roleIndicators: {
        user: ['user', 'query', 'human', 'you'],
        assistant: ['model', 'assistant', 'bot', 'response', 'gemini', 'ai']
      },
      
      // Completion detection
      streamingClasses: ['streaming', 'generating'],
      completionButtons: [
        'button[aria-label*="Copy" i]',
        'button[title*="Copy" i]',
        'button[aria-label*="Share" i]'
      ]
    },
    filtering: {
      // Minimum response length to log (filters out streaming status messages)
      minResponseLength: 50,  // Responses must be at least 50 chars
      
      // Filter out Gemini's thinking sections and streaming status messages
      skipPatterns: [
        { type: 'class', values: ['thinking', 'reasoning', 'expandable', 'collapsible'] },
        { type: 'aria-label', values: ['thinking', 'show thinking', 'reasoning'] },
        { 
          type: 'content',
          maxLength: 150,  // Filter short messages that match these patterns
          keywords: [
            // Core thinking keywords
            'thinking', 'reasoning', 'analyzing', 'interpreting', 
            'pinpointing', 'considering', 'evaluating', 'examining', 
            'assessing', 'exploring', 'investigating',
            
            // Header patterns
            'sources', 'references', 'citations',
            
            // Intent/analysis patterns
            'intent', 'noise', 'patterns', 'cipher',
            'despite', 'recent studies', 'breakdown',
            
            // Common Gemini thinking prefixes
            'analyzing ', 'interpreting ', 'considering ',
            'examining ', 'evaluating ', 'pinpointing ',
            'exploring ', 'investigating ',
            
            // Streaming status messages (these appear during response generation)
            'constructing', 'discovering', 'gathering', 'finalizing',
            'preparing', 'compiling', 'assembling', 'building',
            'draft', 'details', 'intel', 'knowledge', 'information',
            'just a sec', 'one moment', 'please wait'
          ]
        }
      ],
      skipSelectors: [
        '[aria-label*="thinking" i]',
        '[aria-label*="reasoning" i]',
        '[class*="thinking"]',
        '[class*="reasoning"]',
        '[data-expanded]',  // Expandable sections
        'button[aria-expanded]'  // Collapsible elements
      ],
      // Additional filtering: skip very short messages that look like headers
      minContentLength: 150  // Skip messages shorter than 150 chars if they match patterns
    }
  },
  
  'claude': {
    name: 'Claude',
    url: 'https://claude.ai/',
    detection: {
      // Claude uses a clean message structure
      messageSelector: '[data-test-id*="message"], [class*="Message"]',
      roleIndicators: {
        user: ['user', 'human'],
        assistant: ['assistant', 'claude', 'bot']
      },
      contentSelectors: ['.prose', '[class*="content"]', 'p'],
      
      // Completion detection
      stopButton: 'button[aria-label*="Stop" i]',
      streamingClasses: ['streaming', 'typing']
    },
    filtering: {
      // Claude doesn't have thinking sections in the same way
      skipPatterns: []
    }
  },
  
  'grok': {
    name: 'Grok',
    url: 'https://grok.x.com/',
    detection: {
      // Grok (X.AI) detection
      messageSelector: '[data-testid*="message"], [class*="message"]',
      roleIndicators: {
        user: ['user', 'human'],
        assistant: ['assistant', 'grok', 'ai']
      },
      contentSelectors: ['.message-content', '[class*="text"]'],
      
      // Completion detection
      stopButton: 'button[aria-label*="Stop" i]',
      streamingClasses: ['streaming', 'generating']
    },
    filtering: {
      skipPatterns: []
    }
  }
};

// Get config for a given site key
function getSiteConfig(siteKey) {
  return SITE_CONFIGS[siteKey] || null;
}

// Get site key from URL
function getSiteKeyFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('chatgpt.com')) return 'chatgpt';
    if (hostname.includes('gemini.google.com')) return 'gemini';
    if (hostname.includes('claude.ai')) return 'claude';
    if (hostname.includes('grok.x.com') || hostname.includes('x.com/i/grok')) return 'grok';
    
    return null;
  } catch (e) {
    return null;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SITE_CONFIGS, getSiteConfig, getSiteKeyFromUrl };
}

