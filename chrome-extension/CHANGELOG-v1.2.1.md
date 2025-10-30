# RTool Chrome Extension Changelog

## Version 1.2.1 - 2025-10-30

### **CRITICAL FIX: Manual Prompts Using Wrong Base Prompt**

This version fixes a critical bug where manual prompts were being logged with the **wrong base prompt** (the previous auto-prompt instead of "Manual Prompt"), causing duplicates and incorrect CSV entries.

---

## **Problem**

**Symptoms:**
1. Manual prompts were logged with the **previous auto-prompt's base prompt** instead of "Manual Prompt"
2. CSV showed **duplicate entries** with the same base prompt but different responses
3. Example from CSV:
   - Line 2: Base="What is 7 x 7 x 7?", Response="343" (correct auto-prompt)
   - Line 52: Base="What is 7 x 7 x 7?", Response="-198" (WRONG - this was actually a manual prompt "And what is 123-321?")

**Root Cause:**

In `content.js`, the `logCompletedResponse()` function was using `injectedPrompt` for ALL responses if it was set, even after `waitingForResponse` was cleared. This meant:

1. Auto-prompt "What is 7 x 7 x 7?" was injected → `injectedPrompt` set
2. Auto-prompt response logged → `waitingForResponse` cleared, but **`injectedPrompt` NOT cleared**
3. User entered manual prompt "And what is 123-321?" → `lastPrompt` updated correctly
4. Manual response logged → Used **old `injectedPrompt`** instead of `lastPrompt`

**Console Evidence:**
```
content.js:415 [RTool] Current lastPrompt: and what is 123-321?
content.js:1283 [RTool] Current state: lastPrompt=and what is 123-321?, injectedPrompt=What is 7 x 7 x 7?, waitingForResponse=false
content.js:1295 [RTool] Using injectedPrompt for logging: What is 7 x 7 x 7?
```

The manual prompt was **detected correctly** but the **wrong prompt was used for logging**.

---

## **Solution**

### **Changes in `content.js` (v1.2.1)**

Modified `logCompletedResponse()` to:

1. **Use `injectedPrompt` ONLY if `waitingForResponse` is true**
   - This ensures `injectedPrompt` is only used for auto-prompt responses
   - Manual prompts will use `lastPrompt` (DOM-detected prompt)

2. **Clear `injectedPrompt` after logging**
   - Prevents old auto-prompt info from being reused for subsequent manual prompts
   - Sets both `injectedPrompt` and `window.injectedPrompt` to `null`

### **Code Changes:**

**BEFORE (v1.2.0):**
```javascript
if (currentSiteKey === 'chatgpt') {
  if (injectedPrompt) {
    promptToUse = injectedPrompt;  // ❌ Always uses injectedPrompt if set
    console.log(`Using injectedPrompt for logging`);
  } else if (lastPrompt && !lastPrompt.includes('window.__oai_')) {
    promptToUse = lastPrompt;
  }
  
  // Clear waitingForResponse flag
  if (waitingForResponse) {
    waitingForResponse = false;
  }
  // ❌ injectedPrompt NOT cleared - will be reused!
}
```

**AFTER (v1.2.1):**
```javascript
if (currentSiteKey === 'chatgpt') {
  if (injectedPrompt && waitingForResponse) {  // ✅ Only use if waiting
    // This is an auto-prompt response
    promptToUse = injectedPrompt;
    console.log(`Using injectedPrompt for auto-prompt response`);
  } else if (lastPrompt && !lastPrompt.includes('window.__oai_')) {
    // This is a manual prompt response
    promptToUse = lastPrompt;
    console.log(`Using lastPrompt for manual prompt response`);
  }
  
  // Clear waitingForResponse flag
  if (waitingForResponse) {
    waitingForResponse = false;
  }
  
  // ✅ Clear injectedPrompt to prevent reuse
  if (injectedPrompt) {
    console.log(`Clearing injectedPrompt to prevent reuse`);
    injectedPrompt = null;
    window.injectedPrompt = null;
  }
}
```

---

## **Expected Behavior After Fix**

### **Auto-Prompt (with transform):**
- Base Prompt: "What is 7 x 7 x 7?"
- Transform: "fantasy:fraktur"
- Prompt: "𝔚𝔥𝔞𝔱 𝔦𝔰 7 𝔵 7 𝔵 7?"
- Response: "343"
- ✅ Logged correctly

### **Manual Prompt:**
- Base Prompt: "Manual Prompt"
- Transform: "none:none"
- Prompt: "And what is 123-321?"
- Response: "-198"
- ✅ Logged correctly (no longer uses old auto-prompt info)

---

## **Testing Instructions**

1. **Reload extension** (chrome://extensions → RTool → Reload)
2. **Open 3 ChatGPT windows**
3. **Send auto-prompt** "What is 7 x 7 x 7?" with transform
4. **Wait for all responses** to complete
5. **In Window 1, manually type** "And what is 123-321?"
6. **Export CSV** and verify:
   - Auto-prompt entries have correct base prompt
   - Manual prompt entry has "Manual Prompt" as base prompt
   - No duplicates with same base prompt but different responses

---

## **Summary of Changes**

### **Updated Component Versions:**
- `content.js`: **v1.2.1** ⭐ (Fixed manual prompt logging)
- `content-extraction.js`: v1.2.0 (no changes)
- `popup.js`: v1.1.5 (no changes)

### **What's Fixed:**
1. ✅ **Manual prompts** now logged with correct base prompt ("Manual Prompt")
2. ✅ **No more duplicates** with same base prompt but different responses
3. ✅ **`injectedPrompt` cleared** after auto-prompt response to prevent reuse

---

## Previous Versions

See `CHANGELOG-v1.2.0.md` for previous changes.


