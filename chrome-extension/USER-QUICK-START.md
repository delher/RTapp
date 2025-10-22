# RTool User Quick Start

Simple 3-step setup for RTool with Google Sheets logging.

---

## Step 1: Install RTool Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder
5. Click the RTool icon (puzzle piece) in your extensions

---

## Step 2: Setup Logging (Optional)

If your team uses shared logging:

1. Get the **webhook URL** from your administrator
   - It looks like: `https://script.google.com/macros/s/ABC.../exec`
2. Click RTool icon → Expand **"📊 Logging Setup"**
3. Paste the webhook URL
4. Click **"💾 Save Settings"**
5. Click **"🧪 Test Connection"** (you should see a success message)
6. Check the box: **"Enable automatic logging"**

✅ Done! Your prompts will now be logged automatically.

---

## Step 3: Use RTool

### Open Target Windows
1. Click RTool icon
2. Select **number of instances** (1-4)
3. Enter **Site URL** (e.g., `https://chatgpt.com`)
4. Click **"Open Windows"**

### Configure Transforms (Optional)
Expand **"Per-Window Transforms"** to set different text transformations for each window:
- **Encoding**: Base64, Hex, Binary, etc.
- **Ciphers**: ROT13, Caesar, Atbash
- **Unicode**: Zalgo, Zero-Width characters
- And more!

### Send Prompts
1. Type your prompt in the **Prompt** box
2. Click **"Send to All Windows"** (or press Enter)
3. Each window gets the prompt with its configured transform

---

## Tips

- 🔧 **Resize Panel**: Click "⤢ Open Floating Panel" for a resizable window
- 🪟 **Window Layout**: Windows open side-by-side automatically
- 🎯 **Per-Window**: Each window can have its own transform
- 📊 **Auto-Log**: When enabled, everything is logged automatically
- ⌨️ **Keyboard**: Press Enter in prompt box to send

---

## Common Sites

RTool works with most websites that have text input. Popular uses:

- **ChatGPT**: `https://chatgpt.com`
- **Claude**: `https://claude.ai`
- **Gemini**: `https://gemini.google.com`
- **Grok**: `https://x.com/i/grok`
- And more!

---

## Need Help?

### Extension won't load
- Make sure Developer mode is enabled
- Try removing and re-adding the extension

### Prompts not sending
- Wait for pages to fully load
- Check that the site isn't blocking scripts
- Try refreshing the target windows

### Logging not working
- Verify webhook URL with your administrator
- Click "Test Connection" to check
- Make sure "Enable automatic logging" is checked

### Contact
Ask your RTool administrator for:
- Webhook URL (for logging)
- Team-specific settings
- Custom transforms or features

---

## Quick Reference

| Action | Shortcut |
|--------|----------|
| Send prompt | Enter key |
| Open panel | Click extension icon |
| Resize panel | Click "⤢ Open Floating Panel" |
| Close all windows | "Close All" button |

---

**Happy red-teaming! 🐉**





