# App Icons

To add custom icons to RTool, place the following files in this directory:

## Required Icon Files

### macOS
- **Filename**: `icon.icns`
- **Format**: Apple Icon Image format
- **Source**: 1024x1024 PNG
- **Convert**: Use `iconutil` or online converter

### Windows
- **Filename**: `icon.ico`
- **Format**: Windows Icon format
- **Sizes**: 256, 128, 64, 48, 32, 16 px
- **Convert**: Use ImageMagick or online converter

### Linux
- **Filename**: `icon.png`
- **Format**: PNG
- **Size**: 512x512 px (or 1024x1024)

## Without Custom Icons

If you don't provide custom icons:
- ✅ App will still build successfully
- ✅ Will use Electron's default icon
- ⚠️ Default icon may look generic

## Quick Icon Generation

From a 1024x1024 PNG source file:

### macOS (.icns)
```bash
# Create iconset
mkdir MyIcon.iconset
sips -z 16 16     source.png --out MyIcon.iconset/icon_16x16.png
sips -z 32 32     source.png --out MyIcon.iconset/icon_16x16@2x.png
sips -z 32 32     source.png --out MyIcon.iconset/icon_32x32.png
sips -z 64 64     source.png --out MyIcon.iconset/icon_32x32@2x.png
sips -z 128 128   source.png --out MyIcon.iconset/icon_128x128.png
sips -z 256 256   source.png --out MyIcon.iconset/icon_128x128@2x.png
sips -z 256 256   source.png --out MyIcon.iconset/icon_256x256.png
sips -z 512 512   source.png --out MyIcon.iconset/icon_256x256@2x.png
sips -z 512 512   source.png --out MyIcon.iconset/icon_512x512.png
sips -z 1024 1024 source.png --out MyIcon.iconset/icon_512x512@2x.png

# Convert to .icns
iconutil -c icns MyIcon.iconset -o build/icon.icns
```

### Windows (.ico)
```bash
# Using ImageMagick
convert source.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

### Linux (.png)
```bash
# Just resize to 512x512 if needed
sips -z 512 512 source.png --out build/icon.png
```

## Online Converters

If you don't have command-line tools:
- **iConvert Icons**: https://iconverticons.com/online/
- **CloudConvert**: https://cloudconvert.com/
- **AnyConv**: https://anyconv.com/

Upload your PNG and download the required formats.

## Icon Design Tips

1. **Simple design** - Icons look small in dock/taskbar
2. **Square aspect ratio** - 1:1 ratio (1024x1024)
3. **Transparent background** - For better integration
4. **High contrast** - Easy to see at small sizes
5. **Test small sizes** - Check how it looks at 32x32

## Default Behavior

Currently configured to look for:
- `build/icon.icns` (macOS)
- `build/icon.ico` (Windows)
- `build/icon.png` (Linux)

If files are missing, build will succeed but use default Electron icon.





