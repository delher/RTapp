# RTool Chrome Extension Changelog

## Version 1.3.1 - 2025-10-30

### **FIX: Duplicate Entries in CSV**

This version fixes duplicate entries that were appearing in the CSV when responses were logged multiple times.

---

## **Problem**

**Symptoms:**
- CSV showed duplicate entries with the same window, prompt, and response
- Example from CSV:
  - Line 2: Window 1, "What is 222-111?", response "111"
  - Line 3: Window 1, "What is 222-111?", response "111" (DUPLICATE)

**Root Cause:**

When `addLogEntry()` was called multiple times with the same response (due to retry logic or debouncing), it would:
1. Find a pending entry and update it
2. Save to storage
3. Get called again with the same response
4. Find ANOTHER pending entry (if multiple existed) and update it too
5. Result: Two completed entries with the same response

The duplicate detection checked if the response already existed:
```javascript
const isDuplicate = sessionLogs.some(log => 
  log.windowIndex === windowIndex && 
  log.response === response
);
```

But this didn't prevent the issue because:
- First call: No completed entries with this response yet → Not a duplicate → Updates first pending entry
- Second call: Now there IS a completed entry, but there's still ANOTHER pending entry → Updates second pending entry → **DUPLICATE!**

---

## **Solution**

### **Remove ALL Other Pending Entries After Updating One**

After updating a pending entry with a response, **immediately remove all other pending entries for that window**. This ensures that subsequent calls to `addLogEntry()` with the same response will be caught by the duplicate detection.

### **Changes in `popup.js` (v1.3.1)**

Added code after updating an entry (line 1244-1262):

```javascript
// CRITICAL: Remove ALL other pending entries for this window to prevent duplicates
// This ensures that if addLogEntry is called multiple times with the same response,
// we don't create duplicate entries by matching to different pending entries
const otherPendingEntries = sessionLogs.filter((log, idx) => 
  idx !== matchedEntryIndex &&  // Not the entry we just updated
  log.windowIndex === windowIndex && 
  log.response === '(pending)'
);

if (otherPendingEntries.length > 0) {
  console.log(`[RTool] [Window ${windowIndex}] Removing ${otherPendingEntries.length} other pending entries to prevent duplicates`);
  otherPendingEntries.forEach(entry => {
    const idx = sessionLogs.indexOf(entry);
    if (idx !== -1) {
      console.log(`[RTool] [Window ${windowIndex}] Removing pending entry: ${entry.basePrompt?.substring(0, 30)}`);
      sessionLogs.splice(idx, 1);
    }
  });
}
```

---

## **How It Works**

### **Before (v1.3.0):**
1. Window 1 has 2 pending entries (auto-prompt + old garbage)
2. Response arrives → `addLogEntry()` called
3. Finds first pending entry → Updates it
4. `addLogEntry()` called again (retry/debounce)
5. Finds second pending entry → Updates it → **DUPLICATE!**

### **After (v1.3.1):**
1. Window 1 has 2 pending entries (auto-prompt + old garbage)
2. Response arrives → `addLogEntry()` called
3. Finds first pending entry → Updates it
4. **Removes second pending entry immediately**
5. `addLogEntry()` called again (retry/debounce)
6. Duplicate detection: "Response already exists for this window" → **SKIPPED!**

---

## **Expected Behavior**

### **Auto-Prompt:**
- 1 pending entry created when prompt is sent
- 1 completed entry after response arrives
- **No duplicates** even if `addLogEntry()` is called multiple times

### **Manual Prompt:**
- 1 pending entry created when prompt is detected
- Old auto-prompt pending entries are removed
- 1 completed entry after response arrives
- **No duplicates**

---

## **Testing Instructions**

1. **Reload extension** (chrome://extensions → RTool → Reload)
2. **Clear logs** in popup
3. **Open 3 ChatGPT windows**
4. **Send auto-prompt** "What is 7 x 7 x 7?" with transforms
5. **Wait for all responses**
6. **In Window 1, manually type** "And what is 123-321?"
7. **Wait for response**
8. **Export CSV** and verify:
   - 3 auto-prompt entries (one per window)
   - 1 manual prompt entry
   - **NO DUPLICATES**
   - Total: 4 entries

---

## **Summary of Changes**

### **Updated Component Versions:**
- `popup.js`: **v1.3.1** ⭐ (Remove other pending entries after updating one)
- `content.js`: v1.3.0 (no changes)
- `content-extraction.js`: v1.2.0 (no changes)

### **What's Fixed:**
1. ✅ **No more duplicate entries** in CSV
2. ✅ **Multiple pending entries cleaned up** after response logged
3. ✅ **Retry/debounce calls don't create duplicates**

---

## Previous Versions

- v1.3.0: Detect manual prompts from DOM (MutationObserver)
- v1.2.1: Fixed manual prompt logging (clear injectedPrompt)
- v1.2.0: Removed "substantially different" check

See previous CHANGELOG files for details.


