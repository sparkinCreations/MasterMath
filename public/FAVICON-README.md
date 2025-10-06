# Favicon Setup Guide

## Current Setup

MasterMath uses a single `favicon.png` (500x500, 120KB) for all favicon needs.

## Files in Use

- **favicon.png** - Main favicon (500x500px)
- **manifest.json** - Web app manifest for PWA icons

## Recommended Sizes for Optimal Display

For best results across all platforms, you should create the following sizes from your source favicon.png:

### Desktop Browsers
- **16x16** - favicon-16x16.png (Browser tab)
- **32x32** - favicon-32x32.png (Taskbar, bookmarks)
- **48x48** - favicon-48x48.png (Windows site icon)

### Mobile & Touch Devices
- **180x180** - apple-touch-icon.png (iOS home screen)
- **192x192** - android-chrome-192x192.png (Android home screen)
- **512x512** - android-chrome-512x512.png (Android splash screen)

### Legacy Support
- **favicon.ico** - Multi-resolution .ico file (16x16, 32x32, 48x48)

## How to Generate Optimized Favicons

### Option 1: Online Tools (Easiest)
1. Visit https://realfavicongenerator.net/
2. Upload your `favicon.png`
3. Download the generated package
4. Replace files in `/public` folder

### Option 2: Using ImageMagick (Command Line)
```bash
# Install ImageMagick
brew install imagemagick  # macOS
# or
sudo apt-get install imagemagick  # Linux

# Generate different sizes
convert favicon.png -resize 16x16 favicon-16x16.png
convert favicon.png -resize 32x32 favicon-32x32.png
convert favicon.png -resize 48x48 favicon-48x48.png
convert favicon.png -resize 180x180 apple-touch-icon.png
convert favicon.png -resize 192x192 android-chrome-192x192.png
convert favicon.png -resize 512x512 android-chrome-512x512.png

# Generate .ico file (multi-resolution)
convert favicon.png -define icon:auto-resize=16,32,48 favicon.ico
```

### Option 3: Using Sharp (Node.js)
```javascript
const sharp = require('sharp');

const sizes = [16, 32, 48, 180, 192, 512];

sizes.forEach(size => {
  sharp('favicon.png')
    .resize(size, size)
    .toFile(`favicon-${size}x${size}.png`);
});
```

## Current Implementation

The app currently uses the same 500x500 PNG for all sizes. While this works, generating optimized sizes will:
- ✅ Improve load performance
- ✅ Better display quality at small sizes
- ✅ Reduce bandwidth usage
- ✅ Support legacy browsers (.ico)

## After Generating Optimized Files

Update `index.html`:
```html
<!-- Replace current favicon links with: -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
```

Update `manifest.json`:
```json
"icons": [
  {
    "src": "/android-chrome-192x192.png",
    "sizes": "192x192",
    "type": "image/png"
  },
  {
    "src": "/android-chrome-512x512.png",
    "sizes": "512x512",
    "type": "image/png"
  }
]
```

## Testing Your Favicon

1. **Local Testing**: Clear browser cache (Cmd/Ctrl + Shift + R)
2. **Online Testing**: https://realfavicongenerator.net/favicon_checker
3. **Mobile Testing**: Add to home screen on iOS/Android

## Current Status

✅ manifest.json created
✅ Apple touch icon configured
✅ Basic PNG favicon working
⏳ Optimized sizes pending (recommended)
⏳ favicon.ico pending (for legacy browsers)

## Notes

- Your current favicon.png (500x500, 120KB) is good quality
- For production, resize to appropriate dimensions to save bandwidth
- The 500x500 source is perfect for generating all needed sizes
- Keep the original 500x500 as your master file

---

*Last updated: October 5, 2025*
*Version: 1.1.0*
