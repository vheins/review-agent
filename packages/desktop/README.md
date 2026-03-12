# Electron Desktop App

Desktop application for PR Review Agent with hot reload support.

## Development

### Install Dependencies

```bash
yarn install
```

### Run with Hot Reload

**Linux/Mac:**
```bash
yarn app:dev
```

**Windows:**
```bash
yarn app:dev:win
```

### Hot Reload Features

1. **Nodemon** - Watches for changes in `electron/` directory
   - Automatically restarts Electron when main process files change
   - Watches: `.js`, `.cjs`, `.html`, `.css` files
   - Delay: 500ms after file change

2. **Electron-Reload** - Reloads renderer process
   - Automatically reloads window when renderer files change
   - No need to restart entire app
   - Faster development cycle

### What Gets Reloaded?

**Full Restart (Nodemon):**
- `electron/main.cjs` - Main process
- `electron/preload.cjs` - Preload script

**Window Reload (Electron-Reload):**
- `electron/index.html` - HTML structure
- `electron/styles.css` - Styles
- `electron/renderer.js` - Renderer JavaScript

### Configuration

**nodemon.json:**
```json
{
  "watch": ["electron/**/*"],
  "ext": "js,cjs,html,css",
  "delay": 500
}
```

**electron-reload in main.cjs:**
```javascript
require('electron-reload')(__dirname, {
  electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
  hardResetMethod: 'exit',
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 100
  }
});
```

## Production Build

```bash
# Build for current platform
yarn build

# Build for specific platform
yarn build:win
yarn build:mac
yarn build:linux
```

## Tips

1. **Save files** - Changes are detected on file save
2. **Wait for reload** - Give it 500ms after saving
3. **Check console** - Look for "Hot reload enabled" message
4. **DevTools** - Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac)

## Troubleshooting

**Hot reload not working?**
1. Check if `electron-reload` is installed: `yarn list electron-reload`
2. Make sure `NODE_ENV=development` is set
3. Check console for error messages
4. Try manual restart: `Ctrl+C` and run `yarn app:dev` again

**App crashes on reload?**
1. Check for syntax errors in your code
2. Look at terminal output for error messages
3. Try running without hot reload: `yarn app`
