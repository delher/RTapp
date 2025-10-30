// Site-specific configurations for different AI chat platforms
// Each config defines how to detect and extract messages for logging
//
// ARCHITECTURE NOTES:
// ===================
// This file contains SITE-SPECIFIC configuration for each AI chat platform.
// Each configuration defines:
//   1. URL and name of the site
//   2. DOM selectors for finding messages
//   3. Filtering rules for excluding unwanted content
//   4. Completion detection methods
//
// When adding a new site or modifying an existing one:
//   - All changes should be isolated to that site's config object
//   - Changes to one site should NOT affect other sites
//   - Test thoroughly with that specific site
//
// The logging system (popup.js) is INDEPENDENT of these configs.
// Extraction logic (content-extraction.js) uses these configs but doesn't
// contain site-specific code itself.

// Use var instead of const to allow re-declaration without errors
var SITE_CONFIGS = window.SITE_CONFIGS || {
  'chatgpt': {
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    detection: {
      // Primary detection methods - try multiple selectors
      messageSelectors: [
        '[data-message-author-role]',
        '[data-testid*="conversation-turn"]',
        'article[data-testid]',
        '.group.w-full',
        '[class*="agent-turn"]',
        '[class*="user-turn"]'
      ],
      
      // Role detection
      roleIndicators: {
        user: [
          '[data-message-author-role="user"]',
          '[data-testid*="user"]',
          '.user-turn',
          '[class*="user"]'
        ],
        assistant: [
          '[data-message-author-role="assistant"]',
          '[data-testid*="assistant"]',
          '.agent-turn',
          '[class*="assistant"]',
          '[class*="agent"]'
        ]
      },
      
      // Completion detection
      stopButton: 'button[aria-label*="Stop" i]',
      regenerateButton: 'button[aria-label*="Regenerate" i]',
      streamingClasses: ['streaming', 'generating'],
      completionButtons: [
        'button[aria-label*="Copy" i]',
        'button[aria-label*="Regenerate" i]'
      ]
    },
    filtering: {
      // Skip UI elements and metadata
      skipPatterns: [
        'Copy code',
        'Regenerate',
        'Continue generating',
        'Stop generating'
      ],
      minResponseLength: 10
    }
  },
  
  'gemini': {
    name: 'Gemini',
    url: 'https://gemini.google.com/',
    detection: {
      // Use specialized extraction for Gemini
      useSpecializedExtraction: true,
      
      // Completion detection
      streamingClasses: ['streaming', 'generating'],
      completionButtons: [
        'button[aria-label*="Copy" i]',
        'button[title*="Copy" i]',
        'button[aria-label*="Share" i]',
        'button[aria-label*="thumbs" i]',
        'button[aria-label*="like" i]',
        'button[aria-label*="dislike" i]'
      ]
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

// Get config for a given site key (use var to allow re-declaration)
var getSiteConfig = window.getSiteConfig || function(siteKey) {
  return SITE_CONFIGS[siteKey] || null;
};

// Get site key from URL (use var to allow re-declaration)
var getSiteKeyFromUrl = window.getSiteKeyFromUrl || function(url) {
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
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SITE_CONFIGS, getSiteConfig, getSiteKeyFromUrl };
}

// Store in window for access
window.SITE_CONFIGS = SITE_CONFIGS;
window.getSiteConfig = getSiteConfig;
window.getSiteKeyFromUrl = getSiteKeyFromUrl;

