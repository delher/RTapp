# RTool Chrome Extension

Multi-window web automation tool with Parseltongue transforms and comprehensive CSV logging.

## Features

- 🪟 **Multi-Window Management**: Open 1-4 browser windows simultaneously
- ✨ **Parseltongue Transforms**: Apply various text transformations per window (Base64, ROT13, Zalgo, etc.)
- 📊 **CSV Logging with Response Capture**: Automatically log prompts, responses, and manual interactions
- 🎯 **Targeted Injection**: Send prompts to specific input fields on any website
- 🔧 **Persistent Control Panel**: Resizable floating control panel that stays open
- 👁️ **Conversation Monitoring**: Capture all manual interactions in each window

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

### CSV Logging (Optional)

Comprehensive logging of all interactions with automatic response capture!

**Features:**
- ✅ Logs RTool-sent prompts with their transforms
- ✅ Captures LLM responses automatically
- ✅ Monitors manual interactions (prompts you type directly)
- ✅ Exports to CSV with full conversation history
- ✅ No external services required

**How to Use:**
1. Open RTool → Expand "📊 CSV Logging"
2. Check "Enable logging"
3. Use RTool normally - all interactions are logged
4. Click "Export CSV" to download your log file
5. Click "Clear Logs" to start fresh

**CSV Format:**
- **Timestamp**: When the prompt was sent
- **Window**: Which window (1-4)
- **Transform**: Applied transform (e.g., "encoding:base64")
- **Prompt**: The prompt text (original or transformed)
- **Response**: The LLM's response
- **Source**: "rtool" (sent via RTool) or "manual" (typed directly)

## Files

- `manifest.json` - Extension configuration and permissions
- `popup.html` - Control panel UI
- `popup.css` - Control panel styling
- `popup.js` - Control panel logic, event handlers, and CSV logging
- `background.js` - Service worker for window management and message routing
- `content.js` - Injected script for prompt injection, transforms, and conversation monitoring
- `README.md` - This file
- `USER-QUICK-START.md` - Simplified guide for end users
- `CHROMEOS-INSTALL.md` - ChromeOS-specific installation instructions

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
