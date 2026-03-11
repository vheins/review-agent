# Electron Simplification - Native Module Fix

## Problem

Electron menggunakan Node.js version yang berbeda dari system Node.js:
- System Node.js: v22.17.0 (MODULE_VERSION 127)
- Electron Node.js: v22.17.0 (MODULE_VERSION 143)

Native module `better-sqlite3` dikompilasi untuk system Node.js, tapi Electron butuh version yang berbeda.

## Solution

**Simplify architecture**: Electron tidak perlu akses database langsung!

### Before (Complex)

```
┌─────────────────────────────────────┐
│  Electron Main Process              │
│  ├─ Load database.js (native)       │ ❌ Version conflict!
│  ├─ Load config.js                  │
│  ├─ Load rule-engine.js             │
│  └─ Handle 20+ IPC calls            │
└─────────────────────────────────────┘
```

### After (Simple)

```
┌─────────────────────────────────────┐
│  Electron Main Process              │
│  ├─ Start/stop backend server       │ ✅ No database access
│  ├─ Handle review process           │
│  └─ Handle 5 simple IPC calls       │
└─────────────────────────────────────┘
         ↓ HTTP/WebSocket
┌─────────────────────────────────────┐
│  Backend Server (Node.js)           │
│  ├─ Database access                 │ ✅ Correct Node version
│  ├─ REST API                        │
│  └─ WebSocket                       │
└─────────────────────────────────────┘
```

## Changes Made

### 1. Simplified electron/main.cjs

**Removed**:
- `loadRuntimeModules()` - No more database loading
- 20+ complex IPC handlers
- Database queries in Electron

**Kept**:
- Backend server auto-start
- Review process control
- Simple runtime config

### 2. Simplified electron/preload.cjs

**Removed**:
- `getDashboardSnapshot()`
- `listPRs()`
- `getPRDetail()`
- `getTeamSecurityData()`
- `setDeveloperAvailability()`
- `getRepositoryConfigData()`
- `saveRepositoryConfigData()`
- `saveCustomRule()`
- `deleteCustomRule()`
- `testCustomRule()`
- `exportMetricsData()`
- `readContextFile()`
- `writeContextFile()`
- `testAgent()`
- `getHistory()`
- `getStats()`

**Kept**:
- `startReview()`
- `stopReview()`
- `executeNow()`
- `getRuntimeConfig()`
- `showNotification()`
- `openExternal()`
- Event listeners

### 3. React UI akan menggunakan fetch()

Instead of:
```javascript
const result = await window.electronAPI.getDashboardSnapshot({ rangeDays });
```

Use:
```javascript
const response = await fetch(`http://127.0.0.1:3000/api/dashboard?rangeDays=${rangeDays}`);
const result = await response.json();
```

## Benefits

1. **No Native Module Conflicts**: Electron tidak load database
2. **Simpler Code**: 5 IPC handlers vs 20+
3. **Better Separation**: Backend handles all data logic
4. **Easier Maintenance**: One source of truth (backend API)
5. **Standard Architecture**: Frontend → API → Database

## Migration Guide

### For Developers

If you're updating app.jsx or other React components:

**Old way (IPC)**:
```javascript
const result = await window.electronAPI.getDashboardSnapshot({ rangeDays: 30 });
```

**New way (HTTP)**:
```javascript
const response = await fetch('http://127.0.0.1:3000/api/dashboard?rangeDays=30');
const result = await response.json();
```

### API Endpoints

Backend server provides these endpoints:
- `GET /api/dashboard` - Dashboard snapshot
- `GET /api/prs` - List PRs
- `GET /api/prs/:id` - PR detail
- `GET /api/team` - Team & security data
- `POST /api/config` - Save config
- And more... (see src/routes/)

## Testing

```bash
# Rebuild for Electron (if needed)
npx electron-rebuild -f -w better-sqlite3

# Run app
yarn app:dev
```

Expected:
- ✅ No "MODULE_VERSION" errors
- ✅ Backend starts automatically
- ✅ Dashboard loads (via HTTP API)
- ✅ WebSocket connects

## Backup Files

Original files backed up as:
- `electron/main.cjs.backup`
- `electron/preload.cjs.backup`

To restore:
```bash
mv electron/main.cjs.backup electron/main.cjs
mv electron/preload.cjs.backup electron/preload.cjs
```

## Future Work

- Update app.jsx to use fetch() instead of IPC
- Add API client helper for React
- Add error handling for API calls
- Add loading states

## Summary

Electron sekarang lebih sederhana dan tidak ada konflik native module. Backend server handle semua database operations, Electron hanya start/stop server dan handle UI.
