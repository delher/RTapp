# RTool Chrome Extension Changelog

## Version 1.2.0 - 2025-10-30

### **CRITICAL FIXES: Manual Prompts & Response Logging**

This version includes two major fixes that were preventing manual prompts and their responses from being logged correctly.

**Problem:** Manual prompts were being filtered out and never captured, resulting in missing entries in the CSV log.

**Root Cause:** The `minResponseLength` filter (10 characters) was being applied to **both user prompts AND assistant responses**. Short prompts like "And 8-4?" (8 chars) or "?" (1 char) were being rejected.

**Solution:** Modified `shouldSkipMessage()` in `content-extraction.js` to only apply the `minResponseLength` filter to **assistant responses**, not user prompts.

---

## **FIX #1: Manual Prompts Being Filtered Out**

### **Changes:**

#### `content-extraction.js` (v1.2.0)
- **Modified `shouldSkipMessage()` function**:
  - Added `role` parameter (default: `null`)
  - Changed minimum length check to: `if (role === 'assistant' && filtering.minResponseLength && ...)`
  - Added comment: "User prompts can be any length, even a single character like '?'"
  
- **Updated all 3 calls to `shouldSkipMessage()`**:
  - Moved role detection BEFORE filtering (where needed)
  - Pass `role` parameter to `shouldSkipMessage()`
  - This ensures role-specific filtering rules are applied correctly

---

## **FIX #2: Response Stability Check Rejecting Valid Responses**

**Problem:** Manual prompt responses were being detected correctly but **not logged**. Console showed:
```
[RTool] Response changed but not substantially different, ignoring
```

**Root Cause:** The `isResponseDifferent()` function was checking if responses were "substantially different" from previous responses. If not, the response was completely ignored and never logged. This prevented legitimate responses from being logged, especially when:
- Two responses were similar in content
- A user asked the same question twice (expecting the same answer)

**Solution:** **Removed the "substantially different" check entirely**. Now:
- **All responses are logged** as long as they complete successfully
- The `responseHistory` duplicate detection in `logCompletedResponse()` still prevents logging the exact same response multiple times in quick succession
- Two legitimate responses can now be identical (e.g., asking "What is 2+2?" twice will log "4" both times)

#### `content.js` (v1.2.0)
- **Removed `isResponseDifferent()` function** entirely
- **Simplified response change detection**:
  - If content changed: Update `pendingResponse`, reset stability counter, proceed with logging
  - If content unchanged: Increment stability counter
  - No more "substantially different" check
- **Removed unnecessary complexity** that was causing valid responses to be rejected

### **Impact:**

✅ **User prompts of ANY length** are now captured correctly:
- Single character prompts: `?`, `!`, `x`
- Short prompts: `And 8-4?`, `Why?`, `Go on`
- Normal prompts: Everything else

✅ **Assistant responses** still have the 10-character minimum filter to avoid capturing UI elements or partial responses.

### **Testing:**

1. **Reload the extension**
2. **Clear logs** in popup
3. **Open 3 windows**
4. **Send 3 auto-prompts** with different transforms
5. **Wait for all responses**
6. **Enter manual prompts** in each window (try short ones like "?" or "8-4?")
7. **Check CSV** - should have 6 entries (3 auto + 3 manual)

### **Console Output to Expect:**

For manual prompts, you should now see:
```
[RTool] [Window N] ========== captureManualPrompt called ==========
[RTool] [Window N] Prompt text: <your prompt>
[RTool] [Window N] blockManualPromptCapture flag: false
[RTool] [Window N] ✓ Manual prompt capture NOT blocked, proceeding...
```

For short prompts, you should see them being processed:
```
[RTool] Element N content preview: And 8-4?
[RTool] Element N FINAL detected role: user
[RTool] Added message N: user (8 chars)
```

---

## **Summary of Changes**

### **Updated Component Versions:**
- `content-extraction.js`: **v1.2.0** ⭐ (FIX #1: Prompt length filtering)
- `content.js`: **v1.2.0** ⭐ (FIX #2: Response stability check)
- `popup.js`: v1.1.5 (no changes)

### **What's Fixed:**
1. ✅ **Short prompts** (like "?" or "8-4?") are now captured
2. ✅ **All responses** are now logged (no more "not substantially different" rejection)
3. ✅ **Identical responses** can be logged multiple times (e.g., asking "What is 2+2?" twice)

---

## Previous Versions

### Version 1.1.5 - 2025-10-30
- Fixed duplicate logging by handling `logConversation` messages correctly in popup.js
- Improved manual prompt diagnostics

### Version 1.1.4 - 2025-10-30
- Fixed `Identifier 'CONTENT_SCRIPT_VERSION' has already been declared` error
- Implemented `blockManualPromptCapture` flag to prevent garbage from overwriting auto-prompt info
- Reduced console noise from extraction warnings

### Version 1.1.3 - 2025-10-30
- Implemented `blockManualPromptCapture` flag for auto-prompts
- Prevented manual prompt captures while waiting for auto-prompt response

### Version 1.1.0 - 2025-10-29
- Enhanced ChatGPT role detection
- Added comprehensive garbage filtering
- Improved prompt tracking for ChatGPT

