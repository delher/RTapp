# RTool Chrome Extension

Multi-window web automation tool with Parseltongue transforms and Google Sheets logging.

## Features

- 🪟 **Multi-Window Management**: Open 1-4 browser windows simultaneously
- ✨ **Parseltongue Transforms**: Apply various text transformations per window (Base64, ROT13, Zalgo, etc.)
- 📊 **Google Sheets Logging**: Automatically log prompts and responses to your spreadsheet
- 🎯 **Targeted Injection**: Send prompts to specific input fields on any website
- 🔧 **Persistent Control Panel**: Resizable floating control panel that stays open

## Quick Start

### Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **"Developer mode"** (top right)
4. Click **"Load unpacked"**
5. Select the `chrome-extension` folder
6. Click the RTool icon in your extensions toolbar

### Basic Usage

1. **Open RTool** - Click the extension icon
2. **Set Instance Count** - Choose 1-4 windows
3. **Enter Site URL** - e.g., `https://chatgpt.com`
4. **Click "Open Windows"** - Windows will open side-by-side
5. **Configure Transforms** - Set different transforms for each window
6. **Enter Prompt** - Type your prompt
7. **Click "Send to All Windows"** - Prompt is sent to all windows with their respective transforms

### Google Sheets Logging (Optional)

Super simple webhook-based logging - no OAuth or API keys needed!

**For Users:**
1. Get the webhook URL from your sheet administrator
2. Open RTool → Expand "📊 Logging Setup"
3. Paste the webhook URL
4. Click "Save Settings" and "Test Connection"
5. Enable logging checkbox

**For Administrators:**
1. Follow the detailed setup guide: [WEBHOOK-SETUP.md](./WEBHOOK-SETUP.md)
2. Add a simple Apps Script to your Google Sheet (copy-paste provided code)
3. Deploy as web app
4. Share the webhook URL with your users

**Quick Summary:**
- ✅ No Google Cloud project needed
- ✅ No OAuth authentication required
- ✅ Just paste a URL and go
- ✅ Perfect for teams using a shared sheet

## Files

- `manifest.json` - Extension configuration and permissions
- `popup.html` - Control panel UI
- `popup.css` - Control panel styling
- `popup.js` - Control panel logic and event handlers
- `background.js` - Service worker for window management
- `content.js` - Injected script for prompt injection
- `sheets-logger.js` - Google Sheets webhook integration
- `WEBHOOK-SETUP.md` - Detailed webhook setup guide for logging

## Parseltongue Transforms

Available transform categories:
- **Encoding**: Base64, Hex, Binary, URL, Morse
- **Ciphers**: ROT13, Caesar, Atbash, Reverse
- **Visual**: Upside Down, Strikethrough, Double-Struck
- **Formatting**: Small Caps, Wide Text, Circled
- **Unicode**: Zero-Width Space, Combining Marks, Zalgo
- **Special**: Leet Speak, Regional Indicator Emoji
- **Fantasy**: Fraktur, Script/Cursive
- **Ancient**: Runic, Phoenician

## Permissions

- `tabs` - Access browser tabs for window management
- `scripting` - Inject content scripts for prompt injection
- `storage` - Save configuration and window state

## Security

- ✅ Content Security Policy enforced
- ✅ No eval() or inline scripts
- ✅ HTTPS-only API calls
- ✅ User data stays in user's Google Spreadsheet
- ✅ No third-party data sharing

## Browser Compatibility

- Chrome 88+
- Edge 88+
- Brave (Chromium-based)
- Opera (Chromium-based)

Not compatible with Firefox (uses Manifest V3)

## Troubleshooting

### Extension won't load
- Check Developer mode is enabled
- Look for errors in `chrome://extensions/`
- Verify all files are present

### Windows not opening
- Check host_permissions in manifest
- Try with a simple URL first (e.g., https://example.com)

### Prompts not sending
- Make sure windows are fully loaded
- Check browser console for errors
- Verify the target site isn't blocking scripts

### Google Sheets logging not working
- Verify webhook URL is correct and complete
- Click "Test Connection" to check webhook
- Make sure logging is enabled (checkbox checked)
- Check that webhook deployment is set to "Anyone" can access
- See WEBHOOK-SETUP.md for detailed troubleshooting

## Development

### Testing Changes
1. Make your changes
2. Go to `chrome://extensions/`
3. Click refresh icon on RTool card
4. Test in the control panel

### Adding Transform Methods
Edit the `transformOptions` object in `popup.js` and implement the transform in `content.js`

### Debugging
- Control panel: Right-click popup → Inspect
- Background: `chrome://extensions/` → RTool → Service worker → Inspect
- Content scripts: Target page → DevTools → Console

## License

For internal/research use. Modify as needed.

## Credits

Inspired by Pliny's Parseltongue project.
