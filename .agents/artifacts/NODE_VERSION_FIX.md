# Node.js Version Fix - System vs Electron

## Problem

Ketika Electron spawn backend server dengan `spawn('node', ...)`, dia menggunakan Node.js dari Electron bundle, bukan system Node.js.

- **System Node.js**: v22.17.0 (MODULE_VERSION 127)
- **Electron's Node.js**: v22.17.0 (MODULE_VERSION 143)

Native module `better-sqlite3` dikompilasi untuk system Node.js, tapi backend server di-spawn dengan Electron's Node.js → **MODULE_VERSION mismatch!**

## Solution

**Use system Node.js explicitly** saat spawn backend server.

### Before

```javascript
backendServerProcess = spawn('node', [serverPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
});
```

Problem: `'node'` resolves to Electron's bundled Node.js

### After

```javascript
// Find system node path
const { execSync } = require('child_process');
let nodePath = 'node';
try {
    nodePath = execSync('which node', { encoding: 'utf8' }).trim();
} catch (e) {
    nodePath = 'node';
}

backendServerProcess = spawn(nodePath, [serverPath], {
    cwd: path.join(__dirname, '..'),
    env: { 
        ...process.env,
        ELECTRON_RUN_AS_NODE: undefined  // Remove Electron env vars
    },
    stdio: ['ignore', 'pipe', 'pipe']
});
```

Solution: Explicitly use system Node.js from PATH

## How It Works

1. **Find system node**: `which node` returns `/usr/bin/node` (system Node.js)
2. **Spawn with full path**: Use absolute path to system Node.js
3. **Clean environment**: Remove `ELECTRON_RUN_AS_NODE` to avoid Electron interference

## Rebuild Strategy

```bash
# For system Node.js (backend server)
npm rebuild better-sqlite3

# For Electron (if needed in future)
npx electron-rebuild -f -w better-sqlite3
```

**Current setup**: Backend server uses system Node.js, so we only need `npm rebuild`.

## Testing

```bash
# Test backend server directly (should work)
node src/server.js

# Test via Electron (should also work now)
yarn app
```

Expected:
- ✅ Backend starts without MODULE_VERSION errors
- ✅ Database initializes successfully
- ✅ API server listening on port 3000

## Architecture

```
┌─────────────────────────────────────┐
│  Electron App                       │
│  (Electron's Node.js v22 - v143)    │
│  ├─ UI rendering                    │
│  ├─ Window management               │
│  └─ Spawn backend server            │
└─────────────────────────────────────┘
         ↓ spawn with system node
┌─────────────────────────────────────┐
│  Backend Server                     │
│  (System Node.js v22 - v127)        │
│  ├─ Database access ✅              │
│  ├─ REST API                        │
│  └─ WebSocket server                │
└─────────────────────────────────────┘
```

## Why This Works

- **Electron**: Doesn't need database access, no native modules
- **Backend**: Uses system Node.js with correct MODULE_VERSION
- **Separation**: Clean boundary between UI and data layer

## Alternative Solutions Considered

### 1. Rebuild for Electron ❌
```bash
npx electron-rebuild -f -w better-sqlite3
```
Problem: Backend server still uses system Node.js when run manually

### 2. Use Electron's Node for backend ❌
Problem: Complicated, requires bundling backend with Electron

### 3. Use system Node explicitly ✅
**Current solution**: Simple, clean, works for both dev and production

## Files Changed

1. **electron/main.cjs** - Use system Node.js for spawning backend
2. **NODE_VERSION_FIX.md** - This documentation

## Verification

```bash
# Check which node is being used
which node
# Output: /usr/bin/node (system Node.js)

# Check Node.js version
node --version
# Output: v22.17.0

# Check native module
ls -la node_modules/better-sqlite3/build/Release/
# Should show better_sqlite3.node compiled for MODULE_VERSION 127

# Run app
yarn app
# Should start without errors
```

## Summary

Backend server sekarang di-spawn dengan system Node.js (bukan Electron's Node.js), jadi native module `better-sqlite3` bisa load dengan benar. Tidak ada lagi MODULE_VERSION mismatch!
