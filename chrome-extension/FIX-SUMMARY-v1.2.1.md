# RTool v1.2.1 - Fix Summary

## **Issue: Manual Prompts Logged with Wrong Base Prompt**

### **What Was Broken:**
- Manual prompts were being logged with the **previous auto-prompt's base prompt** instead of "Manual Prompt"
- This caused **duplicate CSV entries** with the same base prompt but different responses
- Example: Auto-prompt "What is 7 x 7 x 7?" logged correctly, but manual prompt "And what is 123-321?" was also logged with base prompt "What is 7 x 7 x 7?"

### **Root Cause:**
In `content.js`, the `injectedPrompt` variable was **never cleared** after logging an auto-prompt response. When a manual prompt was entered later, the code would still use the old `injectedPrompt` value instead of the newly detected `lastPrompt`.

### **The Fix:**
1. **Only use `injectedPrompt` if `waitingForResponse` is true** (i.e., we're actively waiting for an auto-prompt response)
2. **Clear `injectedPrompt` after logging** to prevent it from being reused for manual prompts

### **Code Change:**
```javascript
// BEFORE (v1.2.0):
if (injectedPrompt) {
  promptToUse = injectedPrompt;  // ❌ Always uses old auto-prompt
}

// AFTER (v1.2.1):
if (injectedPrompt && waitingForResponse) {  // ✅ Only use if actively waiting
  promptToUse = injectedPrompt;
}
// ...
// ✅ Clear after logging
if (injectedPrompt) {
  injectedPrompt = null;
  window.injectedPrompt = null;
}
```

### **What's Fixed:**
✅ Manual prompts now logged with correct base prompt ("Manual Prompt")  
✅ No more duplicate entries with same base prompt  
✅ Auto-prompts still logged correctly with transforms  

### **Testing:**
1. Reload extension
2. Open 3 ChatGPT windows
3. Send auto-prompt with transform
4. Wait for responses
5. Manually type a follow-up question in Window 1
6. Export CSV → verify manual prompt has "Manual Prompt" as base prompt

---

**Version:** 1.2.1  
**Date:** 2025-10-30  
**File Changed:** `content.js`  
**Lines Changed:** 1291-1318  


