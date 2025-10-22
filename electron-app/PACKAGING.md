# RTool Packaging Guide

This guide explains how to package RTool for distribution to other users.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs both `electron` and `electron-builder`.

### 2. Build for Your Platform

**macOS:**
```bash
npm run build:mac
```

**Windows (from macOS/Linux requires Wine):**
```bash
npm run build:win
```

**Linux:**
```bash
npm run build:linux
```

**All platforms (requires Wine for Windows on macOS/Linux):**
```bash
npm run build:all
```

### 3. Find Your Distributable

Built applications will be in the `dist/` directory:
- **macOS**: `RTool-1.0.0.dmg` and `RTool-1.0.0-mac.zip`
- **Windows**: `RTool Setup 1.0.0.exe` and `RTool 1.0.0.exe` (portable)
- **Linux**: `RTool-1.0.0.AppImage` and `rtool_1.0.0_amd64.deb`

## Platform-Specific Details

### macOS

**Output formats:**
- **DMG** - Disk image with drag-to-Applications installer
- **ZIP** - Compressed app bundle

**Requirements:**
- macOS 10.13 or later
- Works on Intel and Apple Silicon (universal binary)

**Code Signing (Optional but Recommended):**

To avoid "unidentified developer" warnings:

1. Get an Apple Developer ID certificate ($99/year)
2. Set environment variables:
   ```bash
   export APPLE_ID="your-apple-id@email.com"
   export APPLE_ID_PASSWORD="app-specific-password"
   export CSC_LINK="/path/to/certificate.p12"
   export CSC_KEY_PASSWORD="certificate-password"
   ```
3. Build:
   ```bash
   npm run build:mac
   ```

**Without code signing:**
- Users will see "RTool is from an unidentified developer"
- Users can bypass: Right-click → Open → Open anyway
- Or: `xattr -cr /Applications/RTool.app`

### Windows

**Output formats:**
- **NSIS Installer** - Traditional Windows setup wizard
- **Portable EXE** - No installation required

**Requirements:**
- Windows 10 or later

**Code Signing (Optional but Recommended):**

To avoid SmartScreen warnings:

1. Get a code signing certificate (e.g., DigiCert, Sectigo)
2. Set environment variables:
   ```bash
   export CSC_LINK="/path/to/certificate.pfx"
   export CSC_KEY_PASSWORD="certificate-password"
   ```
3. Build:
   ```bash
   npm run build:win
   ```

**Building Windows on macOS/Linux:**
- Requires Wine: `brew install wine-stable` (macOS)
- Or use GitHub Actions / Windows VM

**Without code signing:**
- SmartScreen may show "Windows protected your PC"
- Users can click "More info" → "Run anyway"

### Linux

**Output formats:**
- **AppImage** - Universal format, works on most distributions
- **DEB** - Debian/Ubuntu package

**Requirements:**
- Most modern Linux distributions (Ubuntu 18.04+, etc.)

**No code signing required** for Linux.

## Icon Setup (Optional)

The app will work without custom icons, but you can add them:

1. Create icon files:
   - **macOS**: `build/icon.icns` (1024x1024 PNG → icns)
   - **Windows**: `build/icon.ico` (256x256 PNG → ico)
   - **Linux**: `build/icon.png` (512x512 PNG)

2. Convert PNG to platform formats:
   ```bash
   # macOS (requires iconutil)
   mkdir icon.iconset
   sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
   # ... more sizes ...
   iconutil -c icns icon.iconset
   
   # Windows (use online converter or ImageMagick)
   convert icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
   ```

## Distribution Methods

### Method 1: Direct Download

**Best for:** Small user base, internal tools

1. Build the app
2. Upload to file hosting (Google Drive, Dropbox, your server)
3. Share the download link
4. Provide installation instructions

**Pros:** Simple, no infrastructure needed  
**Cons:** No automatic updates, manual distribution

### Method 2: GitHub Releases

**Best for:** Open source projects

1. Create a GitHub repository
2. Tag a release: `git tag v1.0.0 && git push --tags`
3. Build all platforms: `npm run build:all`
4. Upload binaries to GitHub Release
5. Users download from Releases page

**Pros:** Free hosting, version tracking  
**Cons:** Public by default, manual update notification

### Method 3: Website + Auto-Update

**Best for:** Professional distribution

1. Host binaries on a server
2. Implement update server (e.g., using `electron-updater`)
3. Users download from your website
4. App checks for updates automatically

**Pros:** Professional, automatic updates  
**Cons:** Requires server infrastructure, more complex

## Auto-Updates (Advanced)

To add automatic update checking:

1. Install `electron-updater`:
   ```bash
   npm install electron-updater
   ```

2. Add to `main.js`:
   ```javascript
   const { autoUpdater } = require('electron-updater');
   
   app.whenReady().then(() => {
     autoUpdater.checkForUpdatesAndNotify();
   });
   ```

3. Configure update server in `package.json`:
   ```json
   "publish": {
     "provider": "generic",
     "url": "https://your-server.com/updates"
   }
   ```

4. Host update files with proper `latest-mac.yml`, `latest.yml` files

## Testing Your Build

Before distributing:

1. ✅ **Test the installer**: Install on a clean machine
2. ✅ **Test permissions**: Ensure webviews work correctly
3. ✅ **Test security**: Verify URL validation, sandbox
4. ✅ **Test on target OS**: Build on/for the actual platform
5. ✅ **Check file size**: Typical size: 150-250 MB (includes Chromium)

## Reducing Package Size

Electron apps are large (~150MB+) because they include Chromium. To minimize:

1. ✅ Already optimized in `package.json` - only includes necessary files
2. ❌ Don't include `node_modules` unnecessarily (already excluded)
3. ✅ Use compression (DMG/ZIP are compressed)
4. Consider: Remove unused Electron features (advanced)

Typical sizes:
- **macOS DMG**: ~120-180 MB
- **Windows Installer**: ~140-200 MB
- **Linux AppImage**: ~150-220 MB

## CI/CD Automation (Advanced)

### GitHub Actions Example

Create `.github/workflows/build.yml`:

```yaml
name: Build RTool

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: rtool-${{ matrix.os }}
          path: dist/*
```

## Versioning

Update version before building:

```bash
# package.json
"version": "1.1.0"
```

Or use npm:
```bash
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0
```

## Troubleshooting

### "Cannot find module 'electron-builder'"
```bash
npm install --save-dev electron-builder
```

### "Build failed: Wine is required"
For Windows builds on macOS:
```bash
brew install wine-stable
```

### "Code signing failed"
- Verify certificate paths and passwords
- Or build without signing (users will see warnings)
- Remove `CSC_*` environment variables to skip signing

### "App won't open on macOS"
- Remove quarantine: `xattr -cr /Applications/RTool.app`
- Or right-click → Open → Open anyway

### "Windows SmartScreen blocks app"
- Expected without code signing
- Users can click "More info" → "Run anyway"
- Get a code signing certificate for production

## Distribution Checklist

Before sharing with users:

- [ ] Test on clean machine
- [ ] Include README.md in package
- [ ] Include SECURITY.md for security documentation
- [ ] Update version number
- [ ] Create release notes
- [ ] Test all transforms work
- [ ] Test on both HTTP and HTTPS sites
- [ ] Verify URL validation works
- [ ] Check that instances load correctly
- [ ] Test prompt injection on real LLM sites

## Support & Feedback

When distributing to users, provide:
- **README**: How to use RTool
- **SECURITY**: Security considerations
- **Issues/Contact**: Where to report bugs
- **License**: MIT license terms
- **Version**: Current version number

## Legal Considerations

⚠️ **Important**: RTool is a red-teaming tool. When distributing:

1. ✅ **Include disclaimers** - For authorized testing only
2. ✅ **Mention security features** - Sandboxing, isolation, etc.
3. ✅ **Document limitations** - What it doesn't protect against
4. ✅ **Specify use cases** - Security research, not production
5. ❌ **Don't encourage misuse** - Unauthorized testing is illegal

## Example Distribution Package

```
rtool-1.0.0-macos.zip
├── RTool.app (or RTool.dmg)
├── README.md
├── SECURITY.md
└── LICENSE.txt
```

---

**Quick Build Command:**
```bash
npm install && npm run build
```

**Output:** `dist/` directory with platform-specific installers

**Share:** Upload DMG/EXE/AppImage to users





