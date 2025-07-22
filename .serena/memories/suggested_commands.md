# Suggested Commands

## Development
```bash
npm run dev           # Run Electron app in development mode
npm run dev:renderer  # Run only the renderer (Vite) in dev mode
npm run build:main    # Build main process TypeScript
npm run build:renderer # Build renderer with Vite
npm run build         # Build both main and renderer
```

## Testing & Quality
```bash
npm run test      # Run Jest tests
npm run lint      # Run ESLint
npm run typecheck # TypeScript type checking without emitting
```

## Production & Distribution
```bash
npm run start     # Start Electron with built files
npm run dist      # Build and package for current platform
npm run dist:mac  # Build for macOS
npm run dist:win  # Build for Windows
npm run dist:linux # Build for Linux
```

## Git Commands (Darwin/macOS)
```bash
git status
git add -A
git commit -m "message"
git push
git pull
```

## File Operations (Darwin/macOS)
```bash
ls -la            # List files with details
find . -name "*.ts" # Find TypeScript files
grep -r "pattern" . # Search for pattern in files
```