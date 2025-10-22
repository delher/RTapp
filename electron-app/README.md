# RTool

**RTool** is a security-hardened multi-instance web automation tool built with Electron. It allows you to:

- Load 1-4 instances of any website side-by-side
- Send the same prompt to all instances simultaneously
- Each instance maintains separate sessions (cookies, storage, etc.)

## Features

- **Dynamic Instance Count**: Choose 1, 2, 3, or 4 instances
- **Custom URLs**: Load any website you want to automate
- **Per-Instance Transforms**: Each instance can apply different Parseltongue encodings
- **Prompt Automation**: Inject and submit prompts to all instances at once
- **Isolated Sessions**: Each instance has its own cookies and storage
- **Red-Teaming Ready**: Test AI responses to different prompt obfuscations simultaneously
- **🔒 Security Hardened**: CSP, sandboxing, URL validation, prompt sanitization, and more

## Security Features

RTool implements multiple security layers:

- ✅ **Content Security Policy** - Strict CSP prevents external resource loading
- ✅ **Renderer Sandboxing** - Isolated from system with no Node.js access
- ✅ **URL Validation** - Blocks localhost, file://, and malicious protocols
- ⚠️ **No Prompt Sanitization** - Intentional: allows ANY prompt for red-teaming
- ✅ **Permission Control** - Blocks camera, microphone, geolocation by default
- ✅ **Webview Isolation** - Each instance runs in a separate security context
- ✅ **Remote Module Disabled** - All remote access blocked

See [SECURITY.md](SECURITY.md) for complete security documentation.

## Installation

```bash
npm install
```

## Usage

### For Development
```bash
npm start
```

### For Distribution
See [PACKAGING.md](PACKAGING.md) for complete instructions on building distributable installers.

**Quick build:**
```bash
npm run build        # Build for current platform
npm run build:mac    # Build for macOS
npm run build:win    # Build for Windows
npm run build:linux  # Build for Linux
```

Output will be in `dist/` directory.

### ChromeOS Support
RTool can run on Chromebooks with Linux support enabled. See [CHROMEOS.md](CHROMEOS.md) for installation instructions and performance considerations.

## How to Use

1. **Select Instance Count**: Choose 1-4 from the dropdown (default: 3)
2. **Enter Site URL**: Type the website URL (e.g., `https://chatgpt.com`)
3. **Click Load**: All instances will load the website
4. **Log in if needed**: Each instance maintains separate sessions
5. **Configure Transforms** (Optional): For each instance, select:
   - **Transform Category**: Encoding, Ciphers, Visual, Unicode, etc.
   - **Transform Method**: Specific encoding within that category
6. **Enter Prompt**: Type your prompt in the text field
7. **Click "Send to All"**: Each instance will apply its transform and send

### Red-Teaming Example

Test how ChatGPT handles different prompt obfuscations:
- **Instance #1**: No transform (baseline)
- **Instance #2**: Unicode → Zero-Width Space Inject
- **Instance #3**: Visual → Strikethrough

Enter your prompt once, and all three instances will receive different encodings simultaneously!

## Available Transforms (Parseltongue)

Each instance can apply different text transformations:

### Encoding
- Base64, Hexadecimal, Binary, URL Encode, Morse Code

### Ciphers
- ROT13, Caesar +3, Atbash, Reverse

### Visual
- Upside Down, Strikethrough, Double-Struck

### Formatting
- Small Caps, Wide Text, Circled

### Unicode
- Zero-Width Space/Joiner/Non-Joiner Inject
- Combining Marks, Zalgo (Light)

### Special
- Leet Speak, Regional Indicator Emoji

### Fantasy
- Fraktur, Script/Cursive

### Ancient
- Runic, Phoenician

## Supported Sites

RTool works best with sites that use:
- Standard `<textarea>` inputs
- Contenteditable divs (like ChatGPT, Claude, etc.)
- Standard submit buttons

## Troubleshooting

- **Prompt not sending?** Open DevTools (View → Toggle Developer Tools) and check console for errors
- **Site not loading?** Make sure the URL includes `https://`
- **Desktop view not showing?** The app injects CSS to force desktop mode, but some sites may override this

## Technical Details

- Built with Electron 38.x
- Uses `<webview>` tags for isolated instances
- Injects prompts via JavaScript execution
- Simulates user input events for better compatibility

## Development

To run with DevTools open automatically:

```bash
npm start
```

DevTools are enabled by default in `main.js`.
