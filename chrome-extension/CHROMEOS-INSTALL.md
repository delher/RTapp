# RTool Chrome Extension - ChromeOS Installation

**Perfect for Chromebooks!** No Linux container, no installation, just load and go.

## Quick Install (5 Minutes)

### Step 1: Enable Developer Mode

1. Open Chrome
2. Go to `chrome://extensions/`
3. Toggle "Developer mode" ON (top right corner)

### Step 2: Load Extension

1. Click "Load unpacked" button
2. Navigate to the `chrome-extension` folder
3. Click "Select"
4. RTool icon appears in toolbar! 🎉

### Step 3: Allow Pop-ups (Important!)

RTool uses popup windows. You must allow them:

1. Click RTool icon
2. If you see "Pop-ups blocked" warning:
   - Click the pop-up blocked icon in address bar
   - Select "Always allow pop-ups from chrome-extension://..."
   - Reload extension

### Step 4: Test It!

1. Click RTool icon in toolbar
2. Keep default settings:
   - Instances: 3
   - URL: https://chatgpt.com
3. Click "Open Windows"
4. **Three popup windows should appear!** ✅

If windows opened successfully, you're done!

## First Use

1. **Log in** to each window (they're separate sessions)
2. **Configure transforms** (optional):
   - Click "Per-Window Transforms" in popup
   - Set different encodings for each window
3. **Enter a prompt** in the extension popup
4. **Click "Send to All Windows"**
5. **Watch** as all windows receive the prompt!

## Troubleshooting ChromeOS

### Issue: Windows Don't Open

**Cause**: Pop-up blocker

**Fix**:
1. Click address bar pop-up icon
2. "Always allow pop-ups" for this extension
3. Try again

### Issue: Extension Icon Not Showing

**Cause**: Extension not loaded

**Fix**:
1. Go to `chrome://extensions/`
2. Find RTool card
3. Make sure toggle is ON (blue)
4. Click refresh icon if needed

### Issue: "Error loading extension"

**Cause**: Wrong folder selected

**Fix**:
1. Make sure you selected the `chrome-extension` folder
2. Not the parent `RTapp` folder
3. Should contain `manifest.json`

### Issue: Prompts Not Sending

**Cause**: Sites not fully loaded

**Fix**:
1. Wait for sites to fully load (white screen → content visible)
2. Wait 3-5 seconds after login
3. Try sending prompt again

### Issue: Low Performance

**Fix**:
1. Start with 2 windows instead of 4
2. Close other Chrome tabs
3. Use lightweight sites
4. Chromebook performance varies

## Advantages for ChromeOS

Compared to Electron app:

| Feature | Chrome Extension | Electron App |
|---------|-----------------|--------------|
| **Installation** | Load unpacked | Needs Linux container |
| **Performance** | ✅ Native speed | ⚠️ Slower (container overhead) |
| **Resource Usage** | ✅ Lower | ⚠️ Higher |
| **Updates** | Reload button | Reinstall package |
| **Storage** | ✅ Minimal | ~200MB |

## Uninstallation

To remove RTool:

1. Go to `chrome://extensions/`
2. Find RTool card
3. Click "Remove" button
4. Confirm

Done! No files left behind.

## Upgrading

When you get a new version:

1. Download new `chrome-extension` folder
2. Go to `chrome://extensions/`
3. Find RTool card
4. Click refresh icon 🔄
5. Or remove and re-load unpacked

## Performance Tips for Chromebooks

### Budget Chromebook (4GB RAM)
- Use 2 instances max
- One transform at a time
- Close other apps/tabs

### Mid-Range Chromebook (8GB RAM)
- Use 3 instances comfortably
- Multiple transforms OK
- Keep some tabs open

### High-End Chromebook (16GB RAM)
- Use 4 instances no problem
- All features work great
- Full multitasking

## Chrome Web Store?

This extension is currently in development mode ("Load unpacked").

**To publish to Chrome Web Store:**
1. Developer needs Chrome Web Store account ($5 one-time fee)
2. Package extension
3. Submit for review
4. Wait 3-5 business days

**Advantages of Web Store:**
- One-click install
- Automatic updates
- No developer mode needed
- Easier distribution

**For now**: Load unpacked works perfectly!

## Sharing with Others

Want to share RTool with friends/colleagues?

### Method 1: Share Folder
1. Zip the `chrome-extension` folder
2. Share the zip file
3. They follow "Load unpacked" steps above

### Method 2: Pack Extension
1. Go to `chrome://extensions/`
2. Click "Pack extension"
3. Select `chrome-extension` folder
4. Chrome creates `.crx` file
5. Share the `.crx` file
6. They drag-and-drop onto `chrome://extensions/`

Note: Method 2 requires users to enable "Developer mode" too.

## Security on ChromeOS

Chrome extensions on ChromeOS are sandboxed:
- ✅ Can't access local files
- ✅ Can't modify system
- ✅ Limited to Chrome APIs
- ✅ No Linux/Android access

RTool is safe to use on Chromebooks!

## Comparison: Extension vs Electron vs Original

| Version | Best For | Performance | Installation |
|---------|----------|-------------|--------------|
| **Chrome Extension** | ChromeOS | ⭐⭐⭐⭐⭐ | Load unpacked |
| **Electron App** | macOS/Windows/Linux | ⭐⭐⭐⭐ | Package install |
| **Original (iframes)** | None | ⭐⭐ | ❌ Blocked by X-Frame-Options |

**For ChromeOS: Use Chrome Extension!** 🎯

## Support

Having issues? Check:

1. ✅ Developer mode is ON
2. ✅ Extension shows in toolbar
3. ✅ Pop-ups are allowed
4. ✅ Sites are fully loaded
5. ✅ Console shows no errors (F12)

Still stuck? Check the main README.md for detailed troubleshooting.

---

**Enjoy RTool on your Chromebook!** 🚀

No Linux, no installation, just pure Chrome extension goodness.





