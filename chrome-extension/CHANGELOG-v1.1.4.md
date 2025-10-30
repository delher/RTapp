# RTool Chrome Extension - Version 1.1.4 Release Notes

## 🎉 Major Fix: Window 3 Garbage Logging Issue RESOLVED

### Problem Summary
Windows 2 and 3 were experiencing issues where:
- Auto-prompts with transforms were being logged as "Manual Prompt"
- Prompt field contained garbage JavaScript code (e.g., `window.__oai_logHTML?...`)
- Base prompt and transform information were incorrect

### Root Cause
The input monitoring system was capturing garbage from ChatGPT's DOM **after** auto-prompts were sent, which overwrote the correct auto-prompt information in `windowPromptMap`.

### Solution Implemented
Added a **`blockManualPromptCapture` flag** that:
1. Is set to `true` when an auto-prompt is injected
2. Blocks all manual prompt captures while waiting for the auto-prompt response
3. Is cleared when the response is logged

This prevents garbage from overwriting correct auto-prompt information.

## 📝 Changes in Version 1.1.4

### content.js (v1.1.4)
- **Fixed**: Changed `const CONTENT_SCRIPT_VERSION` to `var` to prevent "already declared" errors
- **Added**: `blockManualPromptCapture` flag to prevent garbage capture during auto-prompts
- **Added**: Garbage filtering in `captureManualPrompt()` to block JavaScript code patterns
- **Added**: Enhanced diagnostic logging for response logging
- **Improved**: Better tracking of `injectedPrompt` and `waitingForResponse` states

### content-extraction.js (v1.1.1)
- **Improved**: Reduced console warnings during page initialization
- **Changed**: Only log extraction failures as warnings when on conversation pages
- **Changed**: Log as info instead of warning when page is not ready yet

### popup.js
- **Fixed**: Handle both `logConversation` and `addToLog` actions (removes "Ignoring unknown action" warnings)
- **Improved**: Better message handling and logging

## ✅ Verified Working

All 3 windows now log correctly with:
- ✅ Correct base prompts
- ✅ Correct transforms (none, strikethrough, fraktur, etc.)
- ✅ Correct transformed prompts
- ✅ Complete responses
- ✅ No garbage in any field

## 🧪 Test Results

**Test Case**: 3 windows with auto-prompts
- Window 1: No transform
- Window 2: Strikethrough transform
- Window 3: Fraktur transform

**Result**: All 3 entries logged correctly in CSV with proper prompts, transforms, and responses.

## 🔧 Console Output Improvements

**Before**:
- ❌ `[RTool Popup] Ignoring unknown action: logConversation` (repeated)
- ❌ `[RTool] ChatGPT config extraction failed, using fallback` (on every page load)
- ❌ `[RTool] Fallback extraction found no messages` (on every page load)

**After**:
- ✅ `[RTool Popup] Processing logConversation` (handled correctly)
- ✅ `[RTool] ChatGPT config extraction returned 0 messages (page may not be ready yet)` (info level)
- ✅ `[RTool] Fallback extraction found no messages (page may not be ready yet)` (info level)
- ✅ Warnings only appear when actually on a conversation page

## 📦 Installation

1. Go to `chrome://extensions/`
2. Click "Reload" on the RTool extension
3. Test with 3 windows and various transforms
4. Verify all entries log correctly in CSV

## 🐛 Known Issues

- "1 pending entries skipped" may appear if the first response arrives before the auto-prompt batch is created (harmless)

## 🎯 Next Steps

The extension is now working correctly for all core functionality:
- ✅ Multi-window prompt sending
- ✅ Transform application (all types)
- ✅ Response capture and logging
- ✅ CSV export with correct data
- ✅ Manual prompt capture (when not blocked)

Ready for production use!

