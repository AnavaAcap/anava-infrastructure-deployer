# 🎨 Anava Infrastructure Deployer - Branding Guide

## Logo & Icon Requirements

### Application Icons
You'll need to provide the following icon sizes:

#### macOS (.icns)
- **File location**: `assets/icon.icns`
- **Required sizes**: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- **Format**: ICNS (use `iconutil` or online converter)

#### Windows (.ico)
- **File location**: `assets/icon.ico`
- **Required sizes**: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
- **Format**: ICO

#### Linux (.png)
- **File location**: `assets/icon.png`
- **Size**: 512x512 or 1024x1024
- **Format**: PNG with transparency

### In-App Logo
- **File location**: `src/renderer/assets/logo.svg` (preferred) or `logo.png`
- **Recommended size**: 200x200 for display, SVG for scalability
- **Usage**: Login screen, about dialog, splash screen

## Brand Colors (Suggested Professional Palette)

```css
:root {
  /* Primary - Deep Tech Blue */
  --anava-primary: #1976D2;
  --anava-primary-dark: #115293;
  --anava-primary-light: #42A5F5;
  
  /* Secondary - Security Green */
  --anava-secondary: #00897B;
  --anava-secondary-dark: #00695C;
  --anava-secondary-light: #26A69A;
  
  /* Accent - Innovation Orange */
  --anava-accent: #FF6D00;
  --anava-accent-light: #FF9100;
  
  /* Neutrals */
  --anava-grey-900: #212121;
  --anava-grey-700: #424242;
  --anava-grey-500: #9E9E9E;
  --anava-grey-300: #E0E0E0;
  --anava-grey-100: #F5F5F5;
  
  /* Status Colors */
  --anava-success: #4CAF50;
  --anava-warning: #FFC107;
  --anava-error: #F44336;
  --anava-info: #2196F3;
}
```

## Typography

- **Headings**: Inter, system-ui, -apple-system, sans-serif
- **Body**: Inter, system-ui, -apple-system, sans-serif
- **Code/Mono**: 'Fira Code', 'Consolas', monospace

## How to Create Icons

### From PNG Logo:

1. **macOS ICNS**:
   ```bash
   # Create iconset directory
   mkdir MyIcon.iconset
   
   # Generate all sizes (assuming you have a 1024x1024 source)
   sips -z 16 16     logo.png --out MyIcon.iconset/icon_16x16.png
   sips -z 32 32     logo.png --out MyIcon.iconset/icon_16x16@2x.png
   sips -z 32 32     logo.png --out MyIcon.iconset/icon_32x32.png
   sips -z 64 64     logo.png --out MyIcon.iconset/icon_32x32@2x.png
   sips -z 128 128   logo.png --out MyIcon.iconset/icon_128x128.png
   sips -z 256 256   logo.png --out MyIcon.iconset/icon_128x128@2x.png
   sips -z 256 256   logo.png --out MyIcon.iconset/icon_256x256.png
   sips -z 512 512   logo.png --out MyIcon.iconset/icon_256x256@2x.png
   sips -z 512 512   logo.png --out MyIcon.iconset/icon_512x512.png
   cp logo.png MyIcon.iconset/icon_512x512@2x.png
   
   # Convert to icns
   iconutil -c icns MyIcon.iconset
   ```

2. **Windows ICO**:
   - Use online converter like https://convertio.co/png-ico/
   - Or use ImageMagick: `convert logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`

3. **Linux PNG**:
   - Just use your high-res PNG (512x512 or 1024x1024)

## File Locations Summary

```
anava-infrastructure-deployer/
├── assets/
│   ├── icon.icns          # macOS app icon
│   ├── icon.ico           # Windows app icon
│   └── icon.png           # Linux app icon
├── src/
│   └── renderer/
│       └── assets/
│           ├── logo.svg   # Main app logo
│           ├── logo.png   # Fallback logo
│           └── sounds/    # Easter egg sounds
│               └── retro-deploy.mp3
└── public/
    └── favicon.ico        # Browser favicon
```