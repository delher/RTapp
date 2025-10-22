# Running RTool on ChromeOS

RTool can run on ChromeOS using Linux app support (Crostini).

## Compatibility

### ✅ Supported Chromebooks
- Most Chromebooks from 2019 or later
- Must support Linux apps (Crostini)
- Minimum 4GB RAM (8GB+ recommended)

### ❌ Not Supported
- Chromebooks without Linux support
- ARM-based Chromebooks (requires separate ARM build)
- Very old Chromebooks (pre-2019)

## Check Compatibility

1. **Check Linux support**: Settings → Advanced → Developers
2. **Look for**: "Linux development environment" option
3. **System specs**: Settings → About Chrome OS → Detailed build information

## Installation Methods

### Method 1: Debian Package (.deb) - Recommended

```bash
# 1. Enable Linux (if not already):
#    Settings → Advanced → Developers → Linux development environment → Turn On

# 2. Download rtool_1.0.0_amd64.deb to your Downloads folder

# 3. Open Terminal app (search "Terminal" in launcher)

# 4. Install:
cd ~/Downloads
sudo dpkg -i rtool_1.0.0_amd64.deb

# 5. If you see dependency errors:
sudo apt-get install -f

# 6. Launch RTool:
rtool
```

### Method 2: AppImage - Portable

```bash
# 1. Download RTool-1.0.0.AppImage to Downloads

# 2. Open Terminal

# 3. Make executable:
cd ~/Downloads
chmod +x RTool-1.0.0.AppImage

# 4. Run:
./RTool-1.0.0.AppImage
```

### Method 3: Install from Files App

1. Right-click the `.deb` file in Files app
2. Select "Install with Linux (Beta)"
3. Wait for installation
4. Find RTool in app launcher

## Post-Installation

### Create Desktop Shortcut (Optional)

```bash
mkdir -p ~/.local/share/applications

cat > ~/.local/share/applications/rtool.desktop << EOF
[Desktop Entry]
Name=RTool
Comment=Multi-instance web automation tool
Exec=/opt/RTool/rtool
Icon=/opt/RTool/resources/app/build/icon.png
Terminal=false
Type=Application
Categories=Development;
EOF
```

### Increase Linux Container Resources (Recommended)

RTool is resource-intensive. Allocate more resources:

1. Settings → Advanced → Developers → Linux development environment
2. Click settings gear icon
3. Increase:
   - **Disk size**: 20GB+ (default is often 10GB)
   - RTool itself is ~150-200MB, but needs space for sessions

Note: Can't change RAM allocation directly (uses what's available)

## Performance Optimization

### 1. Close Other Apps
RTool runs 4 Chromium instances simultaneously. Close unnecessary:
- Chrome tabs (keep only essentials)
- Android apps
- Other Linux apps

### 2. Reduce Instance Count
If performance is slow:
- Use 2 instances instead of 3-4
- Each instance = 1 Chromium process

### 3. Lower Webview Resolution
Currently set to zoom based on instance count. For better performance on ChromeOS:
- Use 1-2 instances at a time
- Full-screen the app for better viewing

### 4. Use Lightweight Sites
Some sites are heavier than others:
- ✅ Lighter: ChatGPT, Claude
- ⚠️ Heavier: Complex web apps with lots of animations

## Known Issues on ChromeOS

### Issue 1: Slow Performance
**Symptom**: App feels sluggish, high CPU usage

**Solutions**:
- Reduce instance count to 2
- Close other apps
- Check: `top` in terminal to see resource usage
- Consider: More powerful Chromebook

### Issue 2: Webviews Don't Load
**Symptom**: Blank webviews or "Page failed to load"

**Solutions**:
```bash
# Update Linux container:
sudo apt-get update
sudo apt-get upgrade

# Install missing dependencies:
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 \
  libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0
```

### Issue 3: UI Scaling Issues
**Symptom**: Text too small or too large

**Solutions**:
- Adjust Chromebook display scaling: Settings → Device → Displays
- Or adjust inside RTool (browser zoom shortcuts work)
- Ctrl + "+" to zoom in
- Ctrl + "-" to zoom out
- Ctrl + "0" to reset

### Issue 4: Can't Install .deb
**Symptom**: "dpkg: error processing package"

**Solutions**:
```bash
# Fix broken packages:
sudo apt-get install -f

# Or try AppImage instead:
chmod +x RTool-1.0.0.AppImage
./RTool-1.0.0.AppImage
```

## Uninstallation

### If installed via .deb:
```bash
sudo apt-get remove rtool
# Or:
sudo dpkg -r rtool
```

### If using AppImage:
```bash
rm RTool-1.0.0.AppImage
```

## Alternative: Chrome Extension

If Linux apps don't work well on your Chromebook, consider using the original Chrome extension version (with limitations):

**Pros**:
- Native to Chrome OS
- Better performance
- Lower resource usage

**Cons**:
- Can't load sites that block iframes
- More limited functionality

The Chrome extension files are in the project repository if you want to try that approach.

## Testing Your Installation

Quick test to see if RTool works:

1. Launch RTool
2. Keep default 3 instances
3. Click "Load" (defaults to https://chatgpt.com)
4. Wait for all 3 instances to load
5. If you see 3 ChatGPT instances, it's working! ✅

## Performance Expectations

**Good Chromebook (8GB+ RAM, Intel i5+)**:
- 3-4 instances work smoothly
- Can handle complex sites
- Minimal lag

**Average Chromebook (4GB RAM, Celeron)**:
- 2 instances recommended
- Some sites may be slow
- Expect occasional lag

**Budget Chromebook (2GB RAM)**:
- ⚠️ Not recommended
- May not run at all
- Consider Chrome extension instead

## ARM Chromebooks

If you have an ARM-based Chromebook:

The current Linux builds are x64 only. ARM Chromebooks would need:
```bash
npm run build:linux -- --arm64
```

Let me know if you need an ARM build!

## Support

If RTool doesn't work on your Chromebook:
1. Check Linux container is updated
2. Check system resources (RAM, CPU)
3. Try the AppImage version
4. Consider the Chrome extension alternative
5. Check [GitHub Issues] for similar problems

## Why ChromeOS Support is Limited

ChromeOS runs Linux apps in a container (Crostini):
- Extra layer = performance overhead
- Not all hardware features exposed
- Some system calls restricted
- Better suited for native Chrome apps

For best performance, use RTool on:
- macOS (best performance)
- Windows (good performance)
- Native Linux (good performance)
- ChromeOS (acceptable for testing)

## Summary

**Can RTool run on ChromeOS?** Yes, with Linux support enabled.

**Should you use it on ChromeOS?** Depends:
- ✅ For testing/learning: Yes
- ✅ Powerful Chromebook: Yes
- ⚠️ Budget Chromebook: Might struggle
- ❌ Mission-critical work: Use native OS instead





