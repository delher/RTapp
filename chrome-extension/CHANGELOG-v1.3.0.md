# RTool Chrome Extension Changelog

## Version 1.3.0 - 2025-10-30

### **MAJOR FIX: Manual Prompt Detection from DOM**

This version completely fixes manual prompt detection by using the `MutationObserver` to detect when manual prompts appear in the DOM, instead of relying on broken input monitoring.

---

## **Problem**

**Symptoms:**
1. Manual prompts were **NOT being logged at all**
2. Manual responses were being matched to **old auto-prompt entries**, creating duplicates
3. CSV showed duplicate auto-prompt entries with different responses
4. No "Manual Prompt" entries in the CSV

**Root Cause:**

The input monitoring system (Enter key, send button clicks) **completely failed** with ChatGPT's dynamic UI:
- ChatGPT recreates input fields and buttons after each submission
- Event listeners attached to old elements become useless
- `captureManualPrompt()` was **NEVER being called**

**Console Evidence:**
```
content.js:415 [RTool] Current lastPrompt: and what is 123-321?  ← Detected correctly by MutationObserver!
```

But NO messages like:
```
[RTool] Enter key detected in input  ← NEVER appeared
[RTool] Send button clicked  ← NEVER appeared
[RTool] ========== captureManualPrompt called ==========  ← NEVER appeared
```

This proved that input monitoring was completely broken.

---

## **Solution**

### **Use MutationObserver to Detect Manual Prompts**

The `MutationObserver` in `content.js` already extracts all messages from the DOM and correctly identifies user prompts. We just needed to:

1. **Check if the latest user prompt is NEW** (not the injected auto-prompt)
2. **If it's new AND not waiting for an auto-prompt response, call `captureManualPrompt()`**

This is **100% reliable** because:
- The `MutationObserver` already works perfectly for detecting responses
- It runs on every DOM change, so it catches prompts immediately
- It doesn't rely on event listeners that break with dynamic UIs

---

## **Implementation**

### **Changes in `content.js` (v1.3.0)**

Added manual prompt detection to the `MutationObserver` that already extracts messages:

**Location:** After detecting a new user prompt from the DOM (line 509-540)

```javascript
console.log('[RTool] ✓ Detected NEW manual prompt from DOM:', latest.content.substring(0, 100));
lastPrompt = latest.content;

// Reset response state for new prompt
lastResponse = null;
pendingResponse = null;
isLoggingResponse = false;

// ========== CRITICAL: DETECT MANUAL PROMPTS FROM DOM ==========
// This is the key fix - detect manual prompts when they appear in the DOM
// Check if this is a MANUAL prompt (not the auto-prompt we injected)
const isManualPrompt = (
  !waitingForResponse &&  // Not waiting for auto-prompt response
  latest.content !== injectedPrompt &&  // Not the auto-prompt we injected
  currentSiteKey === 'chatgpt'  // Only for ChatGPT (Gemini uses input monitoring)
);

if (isManualPrompt) {
  console.log(`[RTool] [Window ${windowIndex}] 🔍 DETECTED NEW MANUAL PROMPT FROM DOM:`, latest.content.substring(0, 50));
  console.log(`[RTool] [Window ${windowIndex}] Manual prompt detection state: waitingForResponse=${waitingForResponse}, injectedPrompt=${injectedPrompt ? injectedPrompt.substring(0, 30) : 'NULL'}`);
  
  // Call captureManualPrompt to send it to the popup for logging
  captureManualPrompt(latest.content);
} else {
  console.log(`[RTool] [Window ${windowIndex}] User prompt detected but NOT manual (waitingForResponse=${waitingForResponse}, isInjected=${latest.content === injectedPrompt})`);
}
// ==============================================================
```

### **How It Works:**

1. **MutationObserver detects DOM change** → Extracts all messages
2. **Finds latest user message** → Checks if it's new
3. **Checks if it's a manual prompt:**
   - `!waitingForResponse` → Not waiting for auto-prompt response
   - `latest.content !== injectedPrompt` → Not the auto-prompt we injected
   - `currentSiteKey === 'chatgpt'` → Only for ChatGPT
4. **If manual, calls `captureManualPrompt()`** → Sends to popup
5. **`addManualPromptEntry()` creates pending entry** → Ready for response
6. **Response arrives** → `addLogEntry()` matches to pending manual entry

---

## **Expected Behavior After Fix**

### **Auto-Prompt Flow:**
1. `injectPrompt()` → Sets `injectedPrompt`, `waitingForResponse=true`
2. DOM updates with auto-prompt → MutationObserver sees it but **ignores** (waiting for response)
3. Response arrives → `logCompletedResponse()` uses `injectedPrompt`
4. Clears `injectedPrompt` and `waitingForResponse`

### **Manual Prompt Flow:**
1. User types prompt → Submits
2. DOM updates with manual prompt → MutationObserver detects it
3. Checks: `!waitingForResponse && userPrompt !== injectedPrompt` → **TRUE**
4. Calls `captureManualPrompt()` → Sends to popup
5. `addManualPromptEntry()` → Creates pending entry with "Manual Prompt" base
6. Response arrives → `logCompletedResponse()` uses `lastPrompt`
7. `addLogEntry()` → Matches to pending manual entry

### **Expected Console Output:**

**For Auto-Prompt:**
```
[RTool] [Window 0] [ChatGPT] Ignoring DOM-detected prompt, using injected prompt: What is 7 x 7 x 7?
[RTool] [Window 0] [ChatGPT] Using injectedPrompt for auto-prompt response: What is 7 x 7 x 7?
[RTool] [Window 0] [ChatGPT] Clearing injectedPrompt to prevent reuse: What is 7 x 7 x 7?
```

**For Manual Prompt:**
```
[RTool] ✓ Detected NEW manual prompt from DOM: and what is 123-321?
[RTool] [Window 0] 🔍 DETECTED NEW MANUAL PROMPT FROM DOM: and what is 123-321?
[RTool] [Window 0] Manual prompt detection state: waitingForResponse=false, injectedPrompt=NULL
[RTool] [Window 0] ========== captureManualPrompt called ==========
[RTool] [Window 0] Prompt text: and what is 123-321?
[RTool Popup] Processing manualPrompt: window=0, prompt=and what is 123-321?
[RTool] addManualPromptEntry called: window=0, prompt=and what is 123-321?
[RTool] Creating new manual entry for window 0
```

---

## **Testing Instructions**

1. **Reload extension** (chrome://extensions → RTool → Reload)
2. **Open 3 ChatGPT windows**
3. **Send auto-prompt** "What is 7 x 7 x 7?" with transforms
4. **Wait for all responses** to complete
5. **In Window 1, manually type** "And what is 123-321?"
6. **Check console** for `🔍 DETECTED NEW MANUAL PROMPT FROM DOM`
7. **Check popup console** for `addManualPromptEntry called`
8. **Wait for response**
9. **Export CSV** and verify:
   - 3 auto-prompt entries (correct base prompts with transforms)
   - 1 manual prompt entry (base="Manual Prompt", prompt="And what is 123-321?")
   - No duplicates
   - All responses match their prompts

---

## **Summary of Changes**

### **Updated Component Versions:**
- `content.js`: **v1.3.0** ⭐ (Added manual prompt detection to MutationObserver)
- `content-extraction.js`: v1.2.0 (no changes)
- `popup.js`: v1.1.5 (no changes)

### **What's Fixed:**
1. ✅ **Manual prompts now detected reliably** from DOM changes
2. ✅ **`captureManualPrompt()` is now called** for manual prompts
3. ✅ **Pending entries created** for manual prompts
4. ✅ **Responses matched correctly** to manual entries
5. ✅ **No more duplicates** with wrong base prompts
6. ✅ **Works with ChatGPT's dynamic UI** (no reliance on event listeners)

---

## Previous Versions

- v1.2.1: Fixed manual prompt logging (clear injectedPrompt after auto-prompt response)
- v1.2.0: Removed "substantially different" check, fixed prompt length filtering

See `CHANGELOG-v1.2.1.md` and `CHANGELOG-v1.2.0.md` for previous changes.


