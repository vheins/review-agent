# HTTP API Migration - Completed

## Summary

App.jsx sekarang menggunakan HTTP fetch langsung ke backend API, bukan lagi IPC calls.

## Changes

### 1. Created API Helper

**File**: `electron/api-helper.js`

Centralized HTTP API calls:
```javascript
import { api } from './api-helper.js';

// Instead of:
const result = await window.electronAPI.getDashboardSnapshot({ rangeDays: 30 });

// Now:
const result = await api.getDashboardSnapshot({ rangeDays: 30 });
```

### 2. Updated app.jsx

Replaced all `window.electronAPI.*` calls with `api.*` calls:

- ✅ `getDashboardSnapshot()` → `api.getDashboardSnapshot()`
- ✅ `listPRs()` → `api.listPRs()`
- ✅ `getPRDetail()` → `api.getPRDetail()`
- ✅ `getTeamSecurityData()` → `api.getTeamSecurityData()`
- ✅ `setDeveloperAvailability()` → `api.setDeveloperAvailability()`
- ✅ `getRepositoryConfigData()` → `api.getRepositoryConfigData()`
- ✅ `saveRepositoryConfigData()` → `api.saveRepositoryConfigData()`
- ✅ `saveCustomRule()` → `api.saveCustomRule()`
- ✅ `deleteCustomRule()` → `api.deleteCustomRule()`
- ✅ `testCustomRule()` → `api.testCustomRule()`
- ✅ `exportMetricsData()` → `api.exportMetricsData()`

**Kept** (still using IPC for Electron-specific features):
- ✅ `window.electronAPI.startReview()`
- ✅ `window.electronAPI.stopReview()`
- ✅ `window.electronAPI.executeNow()`
- ✅ `window.electronAPI.getRuntimeConfig()`
- ✅ `window.electronAPI.openExternal()`
- ✅ `window.electronAPI.onLogOutput()`
- ✅ `window.electronAPI.onReviewStopped()`

## Benefits

1. **No Native Module Conflicts**: Electron tidak load database
2. **Standard Architecture**: Frontend → HTTP API → Backend → Database
3. **Easier Testing**: Bisa test API dengan curl/Postman
4. **Better Separation**: Clear boundary antara frontend dan backend
5. **Reusable**: API bisa dipakai dari web browser juga (future)

## API Endpoints Used

Backend server (`src/routes/`) provides:

- `GET /api/dashboard?rangeDays=30` - Dashboard snapshot
- `GET /api/prs?status=open` - List PRs
- `GET /api/prs/:id` - PR detail
- `GET /api/team/security` - Team & security data
- `POST /api/team/availability` - Set developer availability
- `GET /api/config/repository/:id` - Get repository config
- `POST /api/config/repository` - Save repository config
- `POST /api/config/rules` - Save custom rule
- `DELETE /api/config/rules/:id` - Delete custom rule
- `POST /api/config/rules/test` - Test custom rule
- `POST /api/metrics/export` - Export metrics
- `GET /api/reviews/history?limit=50` - Review history
- `GET /api/reviews/stats` - Review stats

## Testing

```bash
# Start app
yarn app:dev
```

Expected:
- ✅ No MODULE_VERSION errors
- ✅ Backend starts automatically
- ✅ Dashboard loads via HTTP API
- ✅ WebSocket connects
- ✅ All features work (PRs, config, rules, etc.)

## Troubleshooting

### API Connection Failed

**Symptom**: Dashboard shows "Unknown" or error

**Check**:
```bash
# Test backend API
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/api/dashboard?rangeDays=30
```

**Solution**:
- Make sure backend server is running
- Check console for errors
- Verify port 3000 is not blocked

### CORS Errors

If you see CORS errors in browser console:

**Solution**: Backend already has CORS enabled in `src/api-server.js`:
```javascript
app.use(cors());
```

Should work out of the box.

## Architecture

```
┌─────────────────────────────────────┐
│  React UI (electron/app.jsx)        │
│  ├─ api.getDashboardSnapshot()      │
│  ├─ api.listPRs()                   │
│  └─ api.getPRDetail()               │
└─────────────────────────────────────┘
         ↓ HTTP fetch()
┌─────────────────────────────────────┐
│  API Helper (electron/api-helper.js)│
│  ├─ Centralized HTTP calls          │
│  └─ Error handling                  │
└─────────────────────────────────────┘
         ↓ HTTP
┌─────────────────────────────────────┐
│  Backend Server (src/api-server.js) │
│  ├─ Express routes                  │
│  ├─ Database access                 │
│  └─ WebSocket server                │
└─────────────────────────────────────┘
```

## Files Changed

1. **electron/api-helper.js** - NEW: HTTP API client
2. **electron/app.jsx** - Updated: Use api helper instead of IPC
3. **HTTP_API_MIGRATION.md** - NEW: This file

## Next Steps

All done! App sekarang menggunakan HTTP API yang lebih standard dan tidak ada konflik native module lagi.
