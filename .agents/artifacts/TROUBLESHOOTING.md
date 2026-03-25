# Troubleshooting Guide

## Quick Fixes

### ✗ Better-SQLite3 Bindings Not Found

**Error**: `Could not locate the bindings file` for `better-sqlite3`

**Cause**: Native module not compiled for your Node.js version

**Solution**:
```bash
# Rebuild the native module
yarn rebuild better-sqlite3

# Then start the app
yarn app:dev
```

**Verify**: Check that the file exists:
```bash
ls node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

---

### ✗ WebSocket Connection Failed

**Error**: `ERR_CONNECTION_REFUSED` on `ws://127.0.0.1:3000/`

**Cause**: Backend server failed to start automatically

**Solution**:
```bash
# Check Electron console for backend startup errors
# Or manually start backend:
yarn server

# Then restart the app:
yarn app:dev
```

**Verify**: Check Electron console for:
```
✓ Backend server started successfully on port 3000
```

---

### ✗ Cannot Read Properties of Null (reading 'prepare')

**Error**: `Cannot read properties of null (reading 'prepare')`

**Cause**: Database not initialized

**Solution**:
```bash
# 1. Stop all processes
# 2. Delete database (if corrupted)
rm data/history.db

# 3. Restart
yarn app:dev
```

**Verify**: Check console for:
```
✓ Database initialized successfully with WAL mode
```

---

### ✗ API Health Shows "Unknown" or Error

**Symptoms**: Dashboard shows API Health as "Unknown" or error message

**Cause**: Backend server not running or database not initialized

**Solution**:
```bash
# Check if server is running
node .scripts/check-server.js

# If not running, start it
yarn server
```

---

### ✗ Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Cause**: Another process is using port 3000

**Solution**:
```bash
# Option 1: Find and kill the process
lsof -ti:3000 | xargs kill -9

# Option 2: Change the port
# Edit .env file:
API_PORT=3001

# Then restart
yarn app:dev
```

---

### ✗ Electron App Won't Start

**Symptoms**: Electron window doesn't open

**Solution**:
```bash
# 1. Check if UI is built
ls electron/dist/

# 2. Rebuild UI
yarn ui:build

# 3. Try again
yarn app
```

---

### ✗ Hot Reload Not Working

**Symptoms**: Changes to code don't reflect in the app

**Solution**:
```bash
# For React UI changes:
# - Should work automatically with Vite HMR
# - If not, check browser console for errors

# For Electron main process changes:
# - Should auto-restart with electron-reload
# - If not, manually restart: Ctrl+C and yarn app:dev

# For backend changes:
# - Requires manual restart
# - Stop server (Ctrl+C) and run: yarn server
```

---

## Diagnostic Commands

### Check Server Status
```bash
node .scripts/check-server.js
```

### Check Database
```bash
# Check if database file exists
ls -lh data/history.db

# Check database integrity (requires sqlite3)
sqlite3 data/history.db "PRAGMA integrity_check;"
```

### Check Ports
```bash
# Check what's using port 3000
lsof -i :3000

# Check what's using port 5173
lsof -i :5173
```

### View Logs
```bash
# View latest log file
tail -f logs/review-agent-$(date +%Y-%m-%d).log

# View all recent logs
ls -lh logs/
```

---

## Common Scenarios

### Scenario 1: Fresh Install

```bash
# 1. Install dependencies
yarn install

# 2. Setup environment
cp .env.example .env

# 3. Start development
yarn app:dev
```

### Scenario 2: After Git Pull

```bash
# 1. Update dependencies
yarn install

# 2. Rebuild UI
yarn ui:build

# 3. Restart
yarn app:dev
```

### Scenario 3: Database Issues

```bash
# 1. Backup current database (if needed)
cp data/history.db data/history.db.backup

# 2. Delete database
rm data/history.db

# 3. Restart (will create fresh database)
yarn app:dev
```

### Scenario 4: Clean Slate

```bash
# 1. Stop all processes
# Press Ctrl+C in all terminals

# 2. Clean build artifacts
rm -rf electron/dist/
rm -rf node_modules/.vite/

# 3. Reinstall and rebuild
yarn install
yarn ui:build

# 4. Start fresh
yarn app:dev
```

---

## Error Messages Reference

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `Could not locate the bindings file` | Native module not compiled | `yarn rebuild better-sqlite3` |
| `ERR_CONNECTION_REFUSED` | Backend not running | `yarn server` |
| `Cannot read properties of null` | Database not initialized | Delete `data/history.db` and restart |
| `EADDRINUSE` | Port already in use | Change port or kill process |
| `Module not found` | Missing dependency | `yarn install` |
| `ENOENT: no such file` | Missing file/directory | Check file paths, rebuild UI |
| `Database locked` | Multiple processes accessing DB | Stop all processes, restart |

---

## Still Having Issues?

1. **Check the logs**: `logs/review-agent-YYYY-MM-DD.log`
2. **Check console output**: Look for error messages
3. **Verify environment**: Check `.env` file settings
4. **Check documentation**: 
   - `README.md` - General usage
   - `RUNNING.md` - Running instructions
   - `ARCHITECTURE.md` - System architecture
   - `FIX_SUMMARY.md` - Recent fixes

---

## Debug Mode

For more detailed logging:

```bash
# Set log level to debug
# Edit .env:
LOG_LEVEL=debug

# Restart
yarn app:dev
```

---

## Getting Help

When reporting issues, include:
1. Error message (full text)
2. Console output
3. Log file content
4. Steps to reproduce
5. Operating system
6. Node.js version (`node --version`)
7. Yarn version (`yarn --version`)
