# Technology Stack

## Runtime & Language

- Node.js >= 18 (ES Modules)
- JavaScript (no TypeScript)

## Core Dependencies

### Backend
- `express` - REST API server
- `better-sqlite3` - SQLite database with native bindings
- `ws` - WebSocket server for real-time updates
- `dotenv` - Environment configuration
- `execa` - Process execution for CLI tools
- `fs-extra` - Enhanced file system operations
- `chalk` & `ora` - CLI output formatting and spinners
- `node-notifier` - Desktop notifications

### Frontend (Electron)
- `electron` - Desktop application framework
- `react` & `react-dom` - UI framework
- `vite` - Build tool and dev server
- `tailwindcss` - CSS framework
- `lucide-react` - Icon library
- `shadcn/ui` components (badge, button, card, input, select, textarea)

### Testing
- `vitest` - Test runner and framework
- `@playwright/test` - E2E testing for Electron UI
- `fast-check` - Property-based testing

### Development
- `nodemon` - Auto-restart on file changes
- `electron-reload` - Hot reload for Electron renderer
- `concurrently` - Run multiple processes
- `wait-on` - Wait for services to be ready

## Build System

### Package Manager
```bash
yarn install
```

### Native Module Compilation
```bash
npm rebuild better-sqlite3
```
Required after installation due to native SQLite bindings.

## Common Commands

### Backend
```bash
yarn start              # Continuous mode (checks every REVIEW_INTERVAL)
yarn once               # Run once and exit
yarn dry-run            # Test mode without actual execution
yarn review <PR_NUM>    # Review specific PR by number
yarn server             # Start REST API + WebSocket server
yarn test               # Run tests once
yarn test:watch         # Run tests in watch mode
```

### Electron Desktop App
```bash
yarn app:dev            # Development with hot reload (Linux/Mac)
yarn app:dev:win        # Development with hot reload (Windows)
yarn app                # Production mode
yarn ui:build           # Build Vite frontend
yarn ui:dev             # Vite dev server only
yarn test:electron-ui   # E2E tests with Playwright
```

### Building Distributables
```bash
yarn build              # Build for current platform
yarn build:win          # Windows
yarn build:mac          # macOS
yarn build:linux        # Linux
```

## Architecture Patterns

### Module System
- ES Modules (`type: "module"` in package.json)
- Use `.js` extension for ES modules
- Use `.cjs` extension for CommonJS (Electron main/preload)
- Import syntax: `import { x } from './module.js'`

### Database
- SQLite with better-sqlite3 (synchronous API)
- Schema in `src/database/schema.sql`
- Transaction support via `dbManager.transaction()`
- Singleton pattern: `dbManager` exported from `database.js`

### Configuration
- Environment variables via `.env` file
- Config manager with repository-specific overrides
- Validation and versioning for repo configs
- Singleton: `configManager` from `config.js`

### Error Handling
- Custom `AppError` class with status codes
- Global error handler middleware for Express
- Structured error responses with error codes

### Logging
- Custom logger with daily rotation (7-day retention)
- Log levels: info, warn, error
- Logs stored in `logs/` directory
- Format: `[timestamp] [LEVEL] message`

### API Design
- RESTful endpoints under `/api/*`
- WebSocket for real-time updates
- CORS enabled
- Compression middleware
- Morgan for request logging
- Simple API key auth (X-API-Key header)

### Testing Conventions
- Vitest for unit/integration tests
- Test files in `tests/` directory
- Pattern: `*.test.js`
- Setup/teardown with `beforeEach`/`afterEach`
- Test database isolation (separate test DB per suite)
- Mock external dependencies (GitHub CLI, AI executors)

## External Dependencies

### Required CLI Tools
- `gh` (GitHub CLI) - authenticated
- One of: `gemini`, `gh copilot`, `kiro`, `claude`, `codex`, `opencode`

### File Structure Conventions
- Source: `src/`
- Tests: `tests/`
- Electron: `electron/`
- Logs: `logs/`
- Data: `data/` (SQLite database)
- Workspace: `workspace/` (cloned repositories)
- Config: `.env` file

## Hot Reload Setup

### Development Mode
- Nodemon watches `electron/` for main process changes
- Electron-reload handles renderer process updates
- Vite dev server on port 5173
- Backend auto-starts on Electron launch

### Backend Server
- Auto-starts when Electron app opens
- Runs on port 3000 (configurable via API_PORT)
- Auto-stops when app closes
- Health check endpoint: `/health`
