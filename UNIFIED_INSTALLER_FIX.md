# Simple Fix for Unified Installer

## What Works (DON'T TOUCH)
- Magical installer auto-discovers cameras
- Shows AI analysis immediately  
- Dark theme looks great
- "Build Infrastructure" button exists

## The ONLY Problems
1. Clicking "Build Infrastructure" → loses all state
2. Traditional installer has light theme
3. Makes user re-authenticate and re-discover

## The Fix (Simple)

### 1. Pass State Forward
When "Build Infrastructure" clicked, the camera and any auth info should carry forward.

### 2. Dark Theme
Apply dark theme to ALL pages in traditional installer.

### 3. Skip Redundant Steps  
Jump straight to infrastructure deployment since camera is already discovered.

That's it. No sandbox. No early login. No breaking what works.