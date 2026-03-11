# Application Architecture

## Overview

The application consists of three main components that work together:

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Desktop App                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React UI (Port 5173 in dev)               │ │
│  │  - Dashboard                                           │ │
│  │  - Configuration                                       │ │
│  │  - Logs & Metrics                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   Main Process (IPC)                   │ │
│  │  - Window management                                   │ │
│  │  - IPC handlers                                        │ │
│  │  - Database queries                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕
                    HTTP + WebSocket
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   Backend Server (Port 3000)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Express API Server                  │ │
│  │  - REST endpoints (/api/*)                            │ │
│  │  - Health check (/health)                             │ │
│  │  - WebSocket server                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  SQLite Database (WAL)                 │ │
│  │  - Pull requests                                       │ │
│  │  - Reviews                                             │ │
│  │  - Metrics                                             │ │
│  │  - Configuration                                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. React UI (Frontend)
- **Location**: `electron/app.jsx`, `electron/components/`
- **Port**: 5173 (development), bundled in production
- **Purpose**: User interface for dashboard, configuration, and monitoring
- **Tech**: React 19, Vite, TailwindCSS, Lucide icons

### 2. Electron Main Process
- **Location**: `electron/main.cjs`, `electron/preload.cjs`
- **Purpose**: 
  - Window management
  - IPC communication between UI and backend
  - Direct database access for performance
  - Process spawning (review agent)
- **Tech**: Electron 40, Node.js

### 3. Backend API Server
- **Location**: `src/server.js`, `src/api-server.js`, `src/routes/`
- **Port**: 3000 (configurable via `API_PORT`)
- **Purpose**:
  - REST API endpoints
  - WebSocket server for real-time updates
  - Database initialization
  - Business logic
- **Tech**: Express 5, ws (WebSocket), better-sqlite3

### 4. Database
- **Location**: `data/history.db`
- **Type**: SQLite with WAL mode
- **Schema**: `src/database/schema.sql`
- **Purpose**: Persistent storage for all application data

## Data Flow

### Startup Sequence

1. **Backend Server** (`yarn server`)
   ```
   src/server.js
   ├─> Initialize database (src/database.js)
   ├─> Start Express server (src/api-server.js)
   └─> Start WebSocket server (src/websocket-server.js)
   ```

2. **Electron App** (`yarn app` or `yarn app:dev`)
   ```
   electron/main.cjs
   ├─> Create browser window
   ├─> Load React UI (electron/app.jsx)
   ├─> Setup IPC handlers
   └─> Connect to backend via HTTP + WebSocket
   ```

### Request Flow

#### Dashboard Data Request
```
React UI
  └─> window.electronAPI.getDashboardSnapshot()
       └─> IPC: 'get-dashboard-snapshot'
            └─> electron/main.cjs handler
                 └─> Load database module
                      └─> Query database
                           └─> Return data to UI
```

#### Real-time Updates
```
Backend Event (PR update, review complete, etc.)
  └─> WebSocket broadcast
       └─> Electron UI receives message
            └─> Update React state
                 └─> UI re-renders
```

## Development Workflow

### Starting Development

```bash
yarn app:dev
```

This runs:
1. `yarn server` - Backend server (port 3000)
2. `yarn ui:dev` - Vite dev server (port 5173)
3. `wait-on tcp:3000 tcp:5173` - Wait for servers
4. `electron electron/main.cjs` - Launch Electron

### Hot Reload

- **React UI**: Vite HMR (instant updates)
- **Electron Main**: electron-reload (auto-restart)
- **Backend**: Manual restart required (or use nodemon)

## Port Usage

| Port | Service | Configurable |
|------|---------|--------------|
| 3000 | Backend API + WebSocket | Yes (`API_PORT`) |
| 5173 | Vite dev server | Yes (vite config) |

## File Structure

```
.
├── electron/              # Electron app
│   ├── main.cjs          # Main process
│   ├── preload.cjs       # Preload script
│   ├── app.jsx           # React UI
│   └── components/       # UI components
├── src/                  # Backend
│   ├── server.js         # Server startup
│   ├── api-server.js     # Express app
│   ├── database.js       # Database manager
│   ├── routes/           # API routes
│   └── websocket-server.js
├── data/                 # Database
│   └── history.db        # SQLite database
└── package.json          # Scripts and dependencies
```

## Key Dependencies

- **Electron**: Desktop app framework
- **React**: UI library
- **Express**: Web server
- **better-sqlite3**: SQLite database
- **ws**: WebSocket server
- **Vite**: Build tool and dev server
- **TailwindCSS**: Styling

## Environment Variables

```env
API_PORT=3000              # Backend server port
NODE_ENV=development       # Environment
VITE_DEV_SERVER_URL=...    # Vite dev server URL (auto-set)
```

## Common Issues

### WebSocket Connection Failed
- **Cause**: Backend server not running
- **Fix**: Run `yarn server` or `yarn app:dev`

### Database Not Initialized
- **Cause**: Database initialization failed
- **Fix**: Check `data/` directory permissions, delete `history.db` and restart

### Port Already in Use
- **Cause**: Another process using port 3000 or 5173
- **Fix**: Change `API_PORT` in `.env` or stop conflicting process
