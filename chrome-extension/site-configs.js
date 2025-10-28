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
      // Focus on actual response containers, not thinking sections
      messageSelectors: [
        // Primary: Look for actual response containers
        '[class*="response"]',
        '[data-response-id]',
        '[class*="message-content"]',
        // Fallback: General message containers
        '[class*="message"]',
        '[data-message-id]'
      ],
      containerSelectors: [
        '[class*="conversation"]',
        '[class*="chat-history"]',
        'main',
        '[role="main"]'
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
      // Minimum response length (very short messages are likely thinking phases)
      minResponseLength: 50,  // Responses must be at least 50 chars

      // Structural filtering - identify thinking messages by DOM structure
      skipSelectors: [
        // Thinking/reasoning sections
        '[aria-label*="thinking" i]',
        '[aria-label*="reasoning" i]',
        '[data-thinking="true"]',
        '[data-reasoning="true"]',

        // Collapsible/expandable sections
        '[aria-expanded="false"]',
        '[data-collapsed="true"]',
        'details:not([open])',
        '.thinking-section',
        '.reasoning-block',

        // Headers and intermediate steps
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        '[class*="header"]',
        '[class*="title"]',
        '[role="heading"]',

        // Progress indicators
        '[class*="progress"]',
        '[class*="loading"]',
        '[class*="spinner"]',
        '[aria-label*="loading" i]',

        // Gemini-specific thinking containers
        '[class*="thinking-container"]',
        '[class*="analysis-section"]',
        '[data-step-type="thinking"]',
        '[data-step-type="analysis"]'
      ],

      // Content-based filtering for remaining edge cases
      skipPatterns: [
        {
          type: 'content',
          maxLength: 200,  // Only check short content
          keywords: [
            // Explicit thinking indicators
            'thinking', 'reasoning', 'analyzing', 'interpreting',
            'considering', 'evaluating', 'examining', 'exploring',
            'investigating', 'processing', 'working', 'searching',
            'finding', 'locating', 'identifying', 'seeking',

            // Status messages
            'constructing', 'gathering', 'finalizing', 'preparing',
            'compiling', 'assembling', 'building', 'draft',
            'details', 'intel', 'knowledge', 'information',

            // Time indicators
            'just a sec', 'one moment', 'please wait',

            // Gemini-specific patterns
            'analyzing ', 'interpreting ', 'considering ',
            'examining ', 'evaluating ', 'exploring ',
            'investigating ', 'processing ', 'working '
          ]
        }
      ],

      // Minimum content length for filtering
      minContentLength: 200  // Skip messages shorter than 200 chars if they match patterns
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

