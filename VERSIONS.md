# RTool - Version Comparison

RTool comes in **two working versions**: Chrome Extension and Electron App. Choose based on your platform and needs.

## Quick Decision Guide

| Your Platform | Best Version | Why |
|--------------|--------------|-----|
| **ChromeOS** | 🥇 Chrome Extension | Native, fast, no Linux needed |
| **macOS** | 🥇 Electron App | Best performance, native app |
| **Windows** | 🥇 Electron App | Full features, native app |
| **Linux** | 🥇 Electron App | Native performance |
| **Any Chrome browser** | 🥈 Chrome Extension | Works everywhere |

## Version Comparison

### 1. Chrome Extension (Multi-Window) ✅ **NEW!**

**Location**: `chrome-extension/`

#### How It Works
- Opens real Chrome popup windows
- Each window = separate browser instance
- Content scripts inject prompts
- No iframes, no restrictions!

#### Pros
- ✅ **Perfect for ChromeOS** - Native Chrome, no Linux needed
- ✅ **No installation** - Just load unpacked
- ✅ **Lower resource usage** - Uses existing Chrome
- ✅ **Better ChromeOS performance** - No container overhead
- ✅ **Works everywhere** - Any Chrome browser
- ✅ **No iframe restrictions** - Real browser windows
- ✅ **Easy updates** - Just reload extension

#### Cons
- ⚠️ **Requires pop-ups** - User must allow pop-ups
- ⚠️ **Window management** - Separate windows, not embedded
- ⚠️ **Screen space** - 4 windows = lots of space
- ⚠️ **Desktop only** - Not available on mobile Chrome

#### Use Cases
- ChromeOS users
- Quick testing
- No installation allowed
- Lower resource environments
- Temporary testing

#### Installation
```bash
1. chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select chrome-extension folder
```

---

### 2. Electron App ✅ **RECOMMENDED**

**Location**: `electron-app/`

#### How It Works
- Standalone desktop application
- Uses Electron (Chromium + Node.js)
- Embedded webviews with per-instance controls
- Full-featured red-teaming tool

#### Pros
- ✅ **Best for desktop** - macOS, Windows, Linux
- ✅ **Native app** - Proper desktop application
- ✅ **Per-instance controls** - Transform settings embedded
- ✅ **Better UX** - Unified interface
- ✅ **Distributable** - DMG/EXE/AppImage packages
- ✅ **Professional** - Standalone tool, not extension
- ✅ **Security hardened** - CSP, sandboxing, URL validation

#### Cons
- ⚠️ **Larger size** - ~200MB (includes Chromium)
- ⚠️ **Installation required** - Must install package
- ⚠️ **ChromeOS performance** - Runs in Linux container (slower)
- ⚠️ **More resources** - Electron overhead

#### Use Cases
- macOS/Windows/Linux desktop
- Professional red-teaming
- Frequent use
- Need packaged application
- Internal tool distribution

#### Installation
```bash
# Development
npm install
npm start

# Distribution
npm run build:mac     # macOS DMG
npm run build:win     # Windows installer
npm run build:linux   # Linux AppImage/deb
```

---

### 3. Original Chrome Extension (Iframes) ❌ **DEPRECATED**

**Status**: Does not work due to X-Frame-Options restrictions

#### Why It Failed
- Used iframes to embed sites
- Blocked by X-Frame-Options headers
- ChatGPT, Claude, etc. refuse to load in iframes
- Content Security Policy prevented embedding

#### What We Learned
- Iframes are not viable for modern web apps
- Need real browser instances
- Led to creation of Multi-Window extension and Electron app

**This version is kept for reference but should not be used.**

---

## Feature Comparison

| Feature | Chrome Extension | Electron App |
|---------|-----------------|--------------|
| **Multi-instance** | ✅ 1-4 popup windows | ✅ 1-4 embedded webviews |
| **Parseltongue transforms** | ✅ Per-window | ✅ Per-instance |
| **Prompt automation** | ✅ Content scripts | ✅ executeJavaScript |
| **Isolated sessions** | ✅ Separate windows | ✅ Separate partitions |
| **URL validation** | ✅ Yes | ✅ Yes |
| **Security hardening** | ✅ Manifest V3 | ✅ Sandboxing + CSP |
| **ChromeOS performance** | ⭐⭐⭐⭐⭐ Native | ⭐⭐⭐ Linux container |
| **macOS/Win/Linux perf** | ⭐⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent |
| **Installation** | Load unpacked | Install package |
| **Distribution** | Share folder/CRX | DMG/EXE/AppImage |
| **Update method** | Reload extension | Reinstall package |
| **Resource usage** | Lower | Higher |
| **UI/UX** | Popup + windows | Unified interface |
| **Professional feel** | Extension | Native app |

## Platform-Specific Recommendations

### ChromeOS Users

**Primary**: Chrome Extension  
**Why**: Native Chrome, no Linux container, better performance

```bash
chrome-extension/
  └── Load unpacked
  └── 5-minute setup
  └── Best performance on ChromeOS
```

**Fallback**: Electron App (if you need Linux)
- Requires: Settings → Developers → Linux enabled
- Performance: Acceptable but slower
- Use case: If you prefer unified UI

### macOS Users

**Primary**: Electron App  
**Why**: Best performance, native app, professional

```bash
electron-app/
  └── npm run build:mac
  └── RTool.dmg installer
  └── Native macOS application
```

**Alternative**: Chrome Extension
- Good for: Quick testing
- Good for: No installation allowed

### Windows Users

**Primary**: Electron App  
**Why**: Native Windows app, full features

```bash
electron-app/
  └── npm run build:win
  └── RTool Setup.exe installer
  └── Native Windows application
```

**Alternative**: Chrome Extension
- Same as macOS alternative

### Linux Users

**Primary**: Electron App  
**Why**: Native Linux app, better performance

```bash
electron-app/
  └── npm run build:linux
  └── RTool.AppImage or .deb
  └── Native Linux application
```

**Alternative**: Chrome Extension
- Same as other platforms

## Architecture Comparison

### Chrome Extension
```
Extension Popup (Control Panel)
       ↓
chrome.windows.create()
       ↓
┌─────────┬─────────┬─────────┐
│ Window1 │ Window2 │ Window3 │ ← Real Chrome windows
└─────────┴─────────┴─────────┘
       ↑
Content Scripts inject prompts
```

### Electron App
```
Main Window (Unified Interface)
┌────────────────────────────────┐
│ ┌────────┬────────┬────────┐  │
│ │Controls│Controls│Controls│  │ ← Per-instance toolbars
│ ├────────┼────────┼────────┤  │
│ │Webview1│Webview2│Webview3│  │ ← Embedded webviews
│ └────────┴────────┴────────┘  │
├────────────────────────────────┤
│ Global prompt input            │
└────────────────────────────────┘
```

## Development Workflow

### If You're Building On Top of RTool

**Choose Chrome Extension if**:
- Targeting ChromeOS primarily
- Want easier distribution (just share folder)
- Need lower resource usage
- Prefer extension ecosystem

**Choose Electron App if**:
- Targeting desktop (Mac/Win/Linux)
- Need professional packaging
- Want unified interface
- Plan to add more features (Electron is more flexible)

### If You're Contributing

Both versions accept contributions:
- **Chrome Extension**: `chrome-extension/` folder
- **Electron App**: `electron-app/` folder

Changes should be coordinated - features should exist in both when possible.

## Migration Between Versions

### From Chrome Extension → Electron App

Settings don't transfer (different storage mechanisms):
- Chrome Extension: `chrome.storage.local`
- Electron App: `electron-store`

Manual reconfiguration needed.

### From Electron App → Chrome Extension

Same as above - manual reconfiguration.

## Which One Should I Download?

### For End Users

**ChromeOS**: Download `chrome-extension/` folder  
**macOS/Windows/Linux**: Download from `electron-app/dist/` after building

### For Developers

Clone entire repo, choose which to work on:
```bash
git clone <repo>
cd RTapp

# For Chrome Extension
cd chrome-extension
# Load unpacked into Chrome

# For Electron App
cd electron-app
npm install
npm start
```

## Future Plans

### Chrome Extension
- [ ] Chrome Web Store publishing
- [ ] Automatic updates
- [ ] More window layout options
- [ ] Export/import configurations

### Electron App
- [ ] Auto-update support
- [ ] More Parseltongue transforms
- [ ] Response comparison view
- [ ] Plugin system

## Summary

**Two working versions, choose based on your needs:**

- 🥇 **ChromeOS**: Chrome Extension (best performance)
- 🥇 **Desktop (Mac/Win/Linux)**: Electron App (best UX)
- ❌ **Original iframe version**: Deprecated (doesn't work)

Both versions have:
- ✅ Parseltongue transforms
- ✅ Multi-instance support
- ✅ Prompt automation
- ✅ Security hardening
- ✅ Same red-teaming capabilities

Choose the one that fits your platform and workflow!





