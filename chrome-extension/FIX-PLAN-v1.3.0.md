# RTool v1.3.0 - Complete Manual Prompt Detection Rewrite

## **Problem Analysis**

After extensive debugging, the root cause is clear:

### **Current Broken Flow:**
1. ✅ Auto-prompt sent → Pending entry created
2. ✅ Auto-prompt response → Updates pending entry
3. ❌ **Manual prompt entered → NO pending entry created** (input monitoring doesn't work)
4. ❌ Manual response arrives → Tries to match, finds old auto-prompt pending → **Updates WRONG entry**

### **Why Input Monitoring Fails:**
- ChatGPT's UI is **completely dynamic** - input fields and buttons are recreated after each submission
- Event listeners attached to old elements become useless
- The `MutationObserver` DOES detect manual prompts correctly (`lastPrompt` is set), but `captureManualPrompt()` is never called

### **Evidence from Console:**
```
content.js:415 [RTool] Current lastPrompt: and what is 123-321?  ← Detected correctly!
content.js:1283 [RTool] Current state: lastPrompt=and what is 123-321?, injectedPrompt=What is 7 x 7 x 7?
content.js:1295 [RTool] Using injectedPrompt for logging: What is 7 x 7 x 7?  ← WRONG!
```

**NO `captureManualPrompt` messages** = Input monitoring is completely broken

---

## **Solution: Detect Manual Prompts from DOM**

Instead of relying on input monitoring (which doesn't work with dynamic UIs), we should:

1. **Use the `MutationObserver` to detect when a new USER message appears in the DOM**
2. **Immediately call `captureManualPrompt()` when detected**
3. **Distinguish between auto-prompts and manual prompts** using timing and state

### **Key Insight:**
The `MutationObserver` in `content.js` already extracts all messages from the DOM and correctly identifies user prompts. We just need to:
- **Check if the latest user prompt is NEW** (not the injected auto-prompt)
- **If it's new, call `captureManualPrompt()` immediately**

---

## **Implementation Plan**

### **Step 1: Add Manual Prompt Detection to MutationObserver**

In `content.js`, after extracting messages:

```javascript
// After extracting messages in MutationObserver
if (messages.length > 0) {
  const latestMessage = messages[messages.length - 1];
  
  // Check if this is a NEW user prompt (not the auto-prompt we injected)
  if (latestMessage.role === 'user') {
    const userPrompt = latestMessage.content;
    
    // Check if this is a manual prompt (not the injected auto-prompt)
    const isManualPrompt = (
      !waitingForResponse &&  // Not waiting for auto-prompt response
      userPrompt !== injectedPrompt &&  // Not the auto-prompt we injected
      userPrompt !== lastPrompt  // Not a duplicate
    );
    
    if (isManualPrompt) {
      console.log(`[RTool] [Window ${windowIndex}] 🔍 Detected NEW manual prompt from DOM:`, userPrompt.substring(0, 50));
      lastPrompt = userPrompt;
      captureManualPrompt(userPrompt);
    }
  }
}
```

### **Step 2: Simplify `captureManualPrompt()`**

Remove all the complex duplicate detection and just send the prompt:

```javascript
function captureManualPrompt(promptText) {
  console.log(`[RTool] [Window ${windowIndex}] ========== captureManualPrompt called ==========`);
  console.log(`[RTool] [Window ${windowIndex}] Prompt text:`, promptText.substring(0, 50));
  
  // Validate prompt
  if (!promptText || promptText.trim().length === 0) {
    return;
  }
  
  // Send to popup
  chrome.runtime.sendMessage({
    action: 'manualPrompt',
    windowIndex: windowIndex,
    prompt: promptText.trim(),
    isManual: true,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    source: 'dom_detection',
    manualOverride: true
  });
}
```

### **Step 3: Fix `logCompletedResponse()` Priority**

Ensure `lastPrompt` is used for manual prompts:

```javascript
// In logCompletedResponse()
if (currentSiteKey === 'chatgpt') {
  // Use injectedPrompt ONLY if waitingForResponse is true
  if (injectedPrompt && waitingForResponse) {
    promptToUse = injectedPrompt;
    console.log(`Using injectedPrompt for auto-prompt response`);
  } else if (lastPrompt && !lastPrompt.includes('window.__oai_')) {
    promptToUse = lastPrompt;
    console.log(`Using lastPrompt for manual prompt response`);
  }
  
  // Clear injectedPrompt after logging
  if (injectedPrompt) {
    injectedPrompt = null;
    window.injectedPrompt = null;
  }
}
```

---

## **Expected Flow After Fix**

### **Auto-Prompt:**
1. `injectPrompt()` → Sets `injectedPrompt`, `waitingForResponse=true`
2. Response arrives → `logCompletedResponse()` uses `injectedPrompt`
3. Clears `injectedPrompt` and `waitingForResponse`

### **Manual Prompt:**
1. User types prompt → DOM updates
2. `MutationObserver` detects new user message
3. Checks: `!waitingForResponse && userPrompt !== injectedPrompt`
4. Calls `captureManualPrompt()` → Sends to popup
5. `addManualPromptEntry()` → Creates pending entry
6. Response arrives → `logCompletedResponse()` uses `lastPrompt`
7. `addLogEntry()` → Matches to pending manual entry

---

## **Files to Modify**

1. **`content.js`** (v1.3.0):
   - Add manual prompt detection to `MutationObserver`
   - Simplify `captureManualPrompt()`
   - Already fixed `logCompletedResponse()` in v1.2.1

2. **`popup.js`** (no changes needed):
   - Already handles `manualPrompt` action correctly
   - `addManualPromptEntry()` already creates pending entries

---

## **Testing Plan**

1. Reload extension
2. Open 3 ChatGPT windows
3. Send auto-prompt "What is 7 x 7 x 7?" with transforms
4. Wait for all responses
5. In Window 1, manually type "And what is 123-321?"
6. Check console for: `🔍 Detected NEW manual prompt from DOM`
7. Check console for: `addManualPromptEntry called`
8. Wait for response
9. Export CSV and verify:
   - 3 auto-prompt entries (correct base prompts)
   - 1 manual prompt entry (base="Manual Prompt", prompt="And what is 123-321?")
   - No duplicates

---

## **Why This Will Work**

1. **Reliable Detection**: Uses the same `MutationObserver` that already works for responses
2. **Simple Logic**: Just checks if the latest user prompt is new
3. **No Input Monitoring**: Doesn't rely on event listeners that break with dynamic UIs
4. **Correct Timing**: Detects prompts immediately when they appear in the DOM
5. **Proper State Management**: Uses `waitingForResponse` and `injectedPrompt` to distinguish auto vs manual

---

**Next Step**: Implement the changes in `content.js`


