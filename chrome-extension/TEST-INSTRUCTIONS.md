# Testing Content Script Injection

## Problem
Content scripts are not loading in ChatGPT windows.

## Test Steps

### Step 1: Verify Current Manifest
1. Go to `chrome://extensions/`
2. Find "RTool - Multi-Window Prompter"
3. Click "Details"
4. Scroll down to "Inspect views"
5. Check if there are any errors

### Step 2: Check What URL ChatGPT Uses
1. Open ChatGPT in a regular tab (not through RTool)
2. Look at the URL bar
3. Is it `https://chatgpt.com/` or something else like `https://chat.openai.com/`?

### Step 3: Manual Injection Test
In a ChatGPT window console, run:
```javascript
// This should work even without content scripts
chrome.runtime.id
```

If this returns undefined, the page might be blocking extensions.

### Step 4: Check Console for Errors
In the ChatGPT window:
1. Open DevTools (F12)
2. Go to Console tab
3. Look for any red errors about "Failed to load resource" or "net::ERR_"
4. These would indicate the script files aren't accessible

### Step 5: Verify File Permissions
The content script files need to be readable. Check:
```bash
ls -la /Users/bert.herring/Documents/GitHub/RTapp/chrome-extension/*.js
```

All should have `-rw-r--r--` permissions.

## Common Issues

### Issue 1: Wrong URL Pattern
If ChatGPT changed their domain, the manifest pattern won't match.
Current patterns:
- `https://chatgpt.com/*`
- `https://*.chatgpt.com/*`

### Issue 2: CSP Blocking
ChatGPT might have Content Security Policy that blocks extension scripts.

### Issue 3: Extension Not Reloaded Properly
After changing manifest.json, you MUST:
1. Go to chrome://extensions/
2. Click the reload button (circular arrow)
3. Close ALL ChatGPT tabs
4. Open NEW tabs

### Issue 4: Script Load Order
If site-configs.js has errors, subsequent scripts won't load.

## Debug Commands

In ChatGPT console:
```javascript
// Check if ANY extension script loaded
window.RTOOL_LOADED

// Check Chrome extension API access
chrome.runtime

// List all global variables starting with RTOOL
Object.keys(window).filter(k => k.includes('RTOOL'))
```

## Next Steps
If none of this works, we may need to:
1. Use programmatic injection only (no manifest content_scripts)
2. Add more aggressive retry logic
3. Check if ChatGPT is blocking extensions

