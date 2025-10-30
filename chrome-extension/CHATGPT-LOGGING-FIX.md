# ChatGPT Logging Issue - Analysis & Fix

## Issue Summary

When testing with ChatGPT, manual prompts were being logged with incorrect data:
- **Expected**: Prompt = "What is 2+2?", Base Prompt = "Manual Prompt", Transform = "none:none"
- **Actual**: Prompt contained garbage like `"window.__oai_logHTML?window.__oai_logHTML():window"`, and base prompt/transform were carried over from previous auto-prompts

## Root Cause

The problem was **NOT** that prompts were too short (they were only 11-12 characters). The issue was:

1. **DOM Garbage Extraction**: ChatGPT's page contains JavaScript code in the DOM (e.g., `window.__oai_logHTML?window.__oai_logHTML():window.__oai_SSR_HTML||Date.now()`)
2. **Incorrect Classification**: This garbage was being extracted and incorrectly classified as a "user" message
3. **Prompt Corruption**: The garbage would overwrite the correct prompt in `lastPrompt`, causing incorrect logging

### Evidence from Console Logs

```
[RTool] Latest content preview: ᴡʜᴀᴛ ɪs 2^2?  ← CORRECT (12 chars)
[RTool] Current lastPrompt: window.__oai_logHTML?window.__oai_logHTML():window  ← GARBAGE!
```

The extraction found the correct prompt, but `lastPrompt` got corrupted with page code.

## Root Cause Analysis

After further investigation, the issue was **two-fold**:

1. **Primary extraction was failing** → falling back to less reliable fallback extraction
2. **Fallback extraction had NO garbage filtering** → JavaScript code was being logged

### Why Primary Extraction Failed

The ChatGPT config uses `[data-message-author-role]` as a selector, which finds elements. However, the `data-message-author-role` attribute was on a **child element**, not the selected element itself. The `detectRole` function couldn't find the role, so all messages were skipped, causing the primary extraction to fail.

### Why Fallback Logged Garbage

The fallback extraction only checked if content was longer than 10 characters - it had **no filtering for JavaScript code or UI elements**. The garbage string was ~200 characters, so it passed through and got logged.

## Solution

### 1. Fixed Primary Extraction (content-extraction.js)

Enhanced role detection to check:
1. The element itself (via `detectRole`)
2. Direct `data-message-author-role` attribute on the element
3. Child elements with `data-message-author-role` attribute

```javascript
// Try to detect role from the element itself first
let role = detectRole(msg, detection.roleIndicators);

// If no role found, check if element has data-message-author-role attribute directly
if (!role && msg.hasAttribute('data-message-author-role')) {
  role = msg.getAttribute('data-message-author-role');
}

// If still no role, look for a child with the attribute
if (!role) {
  const childWithRole = msg.querySelector('[data-message-author-role]');
  if (childWithRole) {
    role = childWithRole.getAttribute('data-message-author-role');
  }
}
```

### 2. Added Garbage Filtering to Fallback (content-extraction.js)

Added the same filtering logic that exists in `content.js` to the fallback extraction:

```javascript
// Filter out JavaScript code and UI garbage
const looksLikeCode = (content.includes('window.') && content.includes('(')) ||
                      (content.includes('window.') && content.includes('function')) ||
                      (content.includes('__oai_')) ||
                      (content.includes('Date.now')) ||
                      (content.includes('requestAnimationFrame'));

// Filter out common UI elements
const uiPatterns = [
  'Get Plus', 'ChatGPT said:', 'You said:', 'Temporary Chat',
  'window.__oai_', 'requestAnimationFrame', ...
];
```

### 3. Enhanced Garbage Filtering (content.js)

Added more aggressive filtering to catch JavaScript code before it's classified as a user prompt:

```javascript
const uiPatterns = [
  // ... existing patterns ...
  'window.__oai_logHTML?window.__oai_logHTML()',
  'Date.now()',
  'window.__oai'
];

// More aggressive code detection
const looksLikeCode = (latest.content.includes('window.') && latest.content.includes('(')) ||
                      (latest.content.includes('window.') && latest.content.includes('function')) ||
                      (latest.content.includes('__oai_')) ||
                      (latest.content.includes('Date.now'));
```

### 2. Robust Prompt Tracking (Already Implemented)

The new tracking variables prevent DOM garbage from corrupting injected prompts:

- `injectedPrompt`: The prompt that RTool injected (set BEFORE DOM interaction)
- `injectedPromptTimestamp`: When it was injected
- `waitingForResponse`: Flag indicating we're waiting for a response to the injected prompt

When `waitingForResponse` is true and `injectedPrompt` is set, DOM-detected prompts are ignored:

```javascript
if (currentSiteKey === 'chatgpt' && waitingForResponse && injectedPrompt) {
  console.log(`[RTool] [ChatGPT] Ignoring DOM-detected prompt, using injected prompt`);
  return; // Don't update lastPrompt - keep the injected one
}
```

## Testing

After this fix, reload the extension and test:

1. **Auto Prompts**: Should log correctly with base prompt and transform
2. **Manual Prompts**: Should log with "Manual Prompt" as base prompt and "none:none" as transform
3. **No Garbage**: Should NOT log any `window.__oai_` or JavaScript code

## Files Modified

1. **`content-extraction.js`**:
   - Fixed primary extraction to properly detect roles from child elements
   - Added comprehensive garbage filtering to fallback extraction

2. **`content.js`**: 
   - Enhanced garbage filtering and code detection in MutationObserver

## Expected Results

After these fixes:

1. **Primary extraction should succeed** - you should see:
   ```
   [RTool] Using ChatGPT config for message extraction
   [RTool] Element 0 role from child attribute: user
   [RTool] Added message 0: user (12 chars)
   ```
   
2. **No fallback needed** - you should NOT see:
   ```
   [RTool] ChatGPT config extraction failed, using fallback
   ```

3. **No garbage in logs** - JavaScript code should be filtered out with messages like:
   ```
   [RTool] Fallback: Skipping element 0 (looks like code): window.__oai_logHTML...
   ```

## Next Steps

If garbage still appears in logs:
1. Check console for `[RTool] Skipping UI element or page content:` messages
2. Add additional patterns to `uiPatterns` array
3. Strengthen `looksLikeCode` detection logic

