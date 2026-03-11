# Auto-Start Backend Server - Flow Diagram

## Sebelum (Manual)

```
┌─────────────────────────────────────────────────────────┐
│  Terminal 1: yarn server                                │
│  ├─ Start backend manually                              │
│  └─ Keep running...                                     │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Terminal 2: yarn ui:dev                                │
│  ├─ Start Vite dev server                               │
│  └─ Keep running...                                     │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Terminal 3: yarn app                                   │
│  └─ Launch Electron                                     │
└─────────────────────────────────────────────────────────┘

❌ Ribet: Butuh 3 terminal
❌ Mudah lupa start backend
❌ Backend tetap running setelah app ditutup
```

## Sekarang (Otomatis)

```
┌─────────────────────────────────────────────────────────┐
│  Terminal 1: yarn app:dev                               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  1. Start Vite Dev Server (port 5173)             │ │
│  │     ✓ Ready in 1100ms                              │ │
│  └────────────────────────────────────────────────────┘ │
│                    ↓                                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  2. Launch Electron App                            │ │
│  │     ├─ Check: Backend running?                     │ │
│  │     │   ├─ Yes → Use existing                      │ │
│  │     │   └─ No → Start new backend                  │ │
│  │     │                                               │ │
│  │     ├─ Spawn: node src/server.js                   │ │
│  │     │   ├─ Initialize database                     │ │
│  │     │   ├─ Start Express server                    │ │
│  │     │   └─ Start WebSocket server                  │ │
│  │     │                                               │ │
│  │     ├─ Wait: Backend ready? (max 30s)              │ │
│  │     │   └─ Check: http://127.0.0.1:3000/health     │ │
│  │     │                                               │ │
│  │     └─ ✓ Backend started on port 3000              │ │
│  └────────────────────────────────────────────────────┘ │
│                    ↓                                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  3. Show Electron Window                           │ │
│  │     ├─ Connect to backend via HTTP                 │ │
│  │     ├─ Connect to backend via WebSocket            │ │
│  │     └─ Dashboard shows: Connected ✓                │ │
│  └────────────────────────────────────────────────────┘ │
│                    ↓                                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  4. On App Close                                   │ │
│  │     ├─ Stop backend server                         │ │
│  │     ├─ Close database                              │ │
│  │     └─ Exit cleanly                                │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

✅ Mudah: Satu command saja
✅ Otomatis: Backend pasti jalan
✅ Clean: Backend stop saat app ditutup
```

## Implementasi Detail

### File: electron/main.cjs

```javascript
// Function to check if server is running
async function isServerRunning(port = 3000) {
    // Try to connect to /health endpoint
    // Returns true if server responds with 200
}

// Function to start backend server
async function startBackendServer() {
    // 1. Check if already running
    if (await isServerRunning()) {
        console.log('✓ Backend already running');
        return true;
    }

    // 2. Spawn backend process
    backendServerProcess = spawn('node', ['src/server.js']);

    // 3. Capture output
    backendServerProcess.stdout.on('data', (data) => {
        console.log(`[Backend] ${data}`);
    });

    // 4. Wait for server to be ready (max 30 seconds)
    for (let i = 0; i < 30; i++) {
        await sleep(1000);
        if (await isServerRunning()) {
            console.log('✓ Backend started successfully');
            return true;
        }
    }

    return false;
}

// On app ready
app.whenReady().then(async () => {
    await startBackendServer();  // Start backend first
    createWindow();              // Then show window
});

// On app close
app.on('window-all-closed', () => {
    if (backendServerProcess) {
        backendServerProcess.kill();  // Stop backend
    }
    app.quit();
});
```

## Keuntungan

### 1. User Experience
- ✅ Satu command untuk semua
- ✅ Tidak perlu ingat start backend
- ✅ Tidak ada terminal tambahan

### 2. Developer Experience
- ✅ Lebih cepat development
- ✅ Tidak ada proses zombie
- ✅ Clean shutdown

### 3. Error Handling
- ✅ Cek duplikat (tidak start ulang)
- ✅ Timeout protection (max 30s)
- ✅ Error logging yang jelas

### 4. Resource Management
- ✅ Backend stop saat app ditutup
- ✅ Tidak ada memory leak
- ✅ Port otomatis freed

## Comparison

| Aspek | Manual | Auto-Start |
|-------|--------|------------|
| Commands | 3 terminal | 1 terminal |
| Setup time | ~30 detik | ~10 detik |
| Lupa start backend | Sering | Tidak mungkin |
| Cleanup | Manual | Otomatis |
| Error prone | Tinggi | Rendah |
| User friendly | ⭐⭐ | ⭐⭐⭐⭐⭐ |

## Testing

### Test 1: Fresh Start
```bash
yarn app:dev
```
Expected:
- ✓ Backend starts automatically
- ✓ Window shows after backend ready
- ✓ Dashboard shows "Connected"

### Test 2: Backend Already Running
```bash
# Terminal 1
yarn server

# Terminal 2
yarn app:dev
```
Expected:
- ✓ Detects existing backend
- ✓ Doesn't start duplicate
- ✓ Uses existing backend

### Test 3: Clean Shutdown
```bash
yarn app:dev
# Close app window
```
Expected:
- ✓ Backend stops automatically
- ✓ No zombie processes
- ✓ Port 3000 freed

## Troubleshooting

### Backend Tidak Start

**Symptom**: App opens but shows "Disconnected"

**Check**:
```bash
# Check Electron console
# Look for: "Backend server failed to start"
```

**Solution**:
```bash
# Start backend manually to see error
yarn server
```

### Port Sudah Dipakai

**Symptom**: Backend fails to start, port in use

**Check**:
```bash
lsof -i :3000
```

**Solution**:
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or change port in .env
API_PORT=3001
```

### Timeout (30 detik)

**Symptom**: "Backend failed to start within 30 seconds"

**Possible causes**:
- Database initialization slow
- Native module not compiled
- Port blocked by firewall

**Solution**:
```bash
# Rebuild native modules
npm rebuild better-sqlite3

# Check database
ls -lh data/history.db

# Try manual start to see error
yarn server
```
