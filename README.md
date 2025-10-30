# RTool - Multi-Instance LLM Red-Teaming Tool

**RTool** is a security-hardened multi-instance web automation tool for red-teaming Large Language Models with Parseltongue text transformations.

## 🎯 Quick Start

### ChromeOS / Chrome Browser Users
```bash
cd chrome-extension/
# Load unpacked in chrome://extensions/
# See: chrome-extension/CHROMEOS-INSTALL.md
```

### Desktop Users (macOS / Windows / Linux)
```bash
cd electron-app/
npm install
npm start
```

## 📦 Two Versions Available

RTool comes in two flavors - choose based on your platform:

| Version | Best For | Location | Docs |
|---------|----------|----------|------|
| **Chrome Extension** | ChromeOS, Chrome browser | `chrome-extension/` | [README](chrome-extension/README.md) |
| **Electron App** | macOS, Windows, Linux | `electron-app/` | [README](electron-app/README.md) |

See [VERSIONS.md](VERSIONS.md) for detailed comparison.

## ✨ Features

Both versions include:

- **Multi-Instance**: Load 1-4 instances of any website simultaneously
- **Parseltongue Transforms**: 8 categories, 30+ encoding methods
- **Per-Instance Configuration**: Each instance can use different transforms
- **Prompt Automation**: Inject and submit prompts to all instances at once
- **Isolated Sessions**: Separate cookies and storage for each instance
- **Security Hardened**: URL validation, CSP, sandboxing
- **Red-Teaming Ready**: Compare AI responses to different prompt obfuscations

## 🐉 Parseltongue Transforms

Test how LLMs respond to different text encodings:

- **Encoding**: Base64, Hex, Binary, URL, Morse
- **Ciphers**: ROT13, Caesar, Atbash, Reverse
- **Visual**: Upside Down, Strikethrough, Double-Struck
- **Formatting**: Small Caps, Wide Text, Circled
- **Unicode**: Zero-Width injection, Combining Marks, Zalgo
- **Special**: Leet Speak, Regional Indicator Emoji
- **Fantasy**: Fraktur, Script/Cursive
- **Ancient**: Runic, Phoenician

## 🚀 Quick Comparison

### Chrome Extension (Multi-Window)
```
✅ Perfect for ChromeOS
✅ No installation needed
✅ Lower resource usage
✅ Uses real Chrome windows
⚠️ Requires pop-up permission
```
## 📖 Documentation

### General
- [VERSIONS.md](VERSIONS.md) - Detailed version comparison
- [LICENSE](LICENSE) - MIT License

### Chrome Extension
- [chrome-extension/README.md](chrome-extension/README.md) - Full documentation
- [chrome-extension/CHROMEOS-INSTALL.md](chrome-extension/CHROMEOS-INSTALL.md) - ChromeOS install guide

### Electron App
- Deprecated due to large size; not suitable for Chromebooks.

## 🎓 Example Use Case

**Red-Team ChatGPT with multiple encodings:**

1. **Load 3 instances** of ChatGPT
2. **Configure transforms**:
   - Instance #1: None (baseline)
   - Instance #2: Unicode → Zero-Width Space Inject
   - Instance #3: Visual → Strikethrough
3. **Enter prompt**: "Explain how to bypass content filters"
4. **Send to all** instances
5. **Compare responses** - See how encoding affects AI behavior!

## 🔒 Security Features

Includes:

- ✅ **Content Security Policy** - No eval, no inline scripts
- ✅ **URL Validation** - Blocks localhost, file://, malicious protocols
- ✅ **Sandboxing** - Isolated execution contexts
- ✅ **No Remote Code** - All code is local
- ⚠️ **No Prompt Sanitization** - Intentional for red-teaming

## ⚙️ Development

### Chrome Extension
```bash
cd chrome-extension/
# Load unpacked in Chrome
# Edit files, reload extension to test
```

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on your platform
5. Submit a pull request

Coordinate features across both versions when possible.

## 📋 Requirements

### Chrome Extension
- Chrome browser (any platform)
- Developer mode enabled
- Pop-up permissions

## ⚠️ Legal & Ethical Use

**For Authorized Testing Only**

RTool is designed for:
- ✅ Security research
- ✅ AI red-teaming
- ✅ Prompt injection testing
- ✅ Internal testing environments

NOT for:
- ❌ Unauthorized testing
- ❌ Malicious use
- ❌ Violating terms of service
- ❌ Illegal activities

Use responsibly and only on systems you have permission to test.

## 📞 Support

- **Issues**: Open a GitHub issue
- **Documentation**: See version-specific READMEs
- **Security**: See [electron-app/SECURITY.md](electron-app/SECURITY.md)

## 🏗️ Project Structure

```
RTapp/
├── README.md                    # This file
├── VERSIONS.md                  # Version comparison
├── chrome-extension/            # Chrome extension version
   ├── manifest.json
   ├── popup.html
   ├── popup.js
   ├── background.js
   ├── content.js
   └── README.md

```


## 📜 License

MIT License - See [LICENSE](LICENSE) file

## 🙏 Credits

Built with:
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/) - Browser extension platform
- [Parseltongue](https://elder-plinius.github.io/P4RS3LT0NGV3/) - Text transformation toolkit inspiration

## 🌟 Star This Repo

If you find RTool useful for your red-teaming work, please star the repository!

---

**Built for security researchers, by security researchers.** 🔒🐉





