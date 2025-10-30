# Force Reload Instructions for Window 3 Caching Issue

## Problem
Chrome is caching old content scripts for Window 3, causing garbage prompts to be logged.

## Solution: Nuclear Option (Guaranteed to Work)

1. **Close ALL RTool windows** (click "Close All" in the popup)

2. **Remove the extension completely**:
   - Go to `chrome://extensions/`
   - Click "Remove" on RTool extension
   - Confirm removal

3. **Restart Chrome completely**:
   - Close ALL Chrome windows
   - Wait 5 seconds
   - Reopen Chrome

4. **Clear Chrome's cache** (optional but recommended):
   - Go to `chrome://settings/clearBrowserData`
   - Select "Cached images and files"
   - Click "Clear data"

5. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `/Users/bert.herring/Documents/GitHub/RTapp/chrome-extension`

6. **Verify version**:
   - Open 3 windows
   - Check each window's console for: `[RTool] Content script version: 1.1.1`
   - **ALL windows must show version 1.1.1**

## Quick Check
After reloading, open the console in Window 3 and look for:
- ✅ `[RTool] Content script version: 1.1.1`
- ✅ `[RTool] Using ChatGPT config for message extraction`
- ❌ NO "ChatGPT config extraction failed, using fallback"

If you still see the old error messages, repeat steps 3-5 (restart Chrome + reload extension).

