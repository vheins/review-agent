# Migration Guide: Express to NestJS

This document outlines the changes made during the migration of the PR Review Agent backend from Express to NestJS.

## Key Changes

### 1. Language & Framework
- **Language**: JavaScript (ESM) -> TypeScript
- **Framework**: Express -> NestJS
- **ORM**: better-sqlite3 (Raw SQL) -> TypeORM (Entities)

### 2. File Organization
- **Express**: Flat structure in `src/` with `routes/` and `database.js`.
- **NestJS**: Modular structure in `src/modules/`. Each module contains its own controller, service, and DTOs.

### 3. Dependency Injection
Logic that was previously imported as singleton instances (e.g., `githubClient`, `aiExecutorRegistry`) is now managed via NestJS Dependency Injection.

**Example**:
```typescript
// Old (Express)
import { githubClient } from './github.js';

// New (NestJS)
constructor(private readonly github: GitHubClientService) {}
```

### 4. Database Layer
The database schema is now defined using TypeORM entities. `better-sqlite3` has been replaced with the `@nestjs/typeorm` and `sqlite3` driver.

**Key Entities**:
- `PullRequest`
- `Review`
- `Comment`
- `ReviewMetrics`
- `RepositoryConfig`
- `DeveloperMetrics`
- `SecurityFinding`
- `AuditTrail`

### 5. API Endpoints
All endpoints now have a global `/api` prefix.

| Feature | Old Path | New Path |
|---------|----------|----------|
| PRs | `/api/prs` | `/api/prs` |
| Health | `/health` | `/api/health` |
| Config | `/api/config` | `/api/config` |
| Metrics | `/api/metrics` | `/api/metrics` |

### 6. WebSockets
The WebSocket implementation now uses `@nestjs/websockets` with the `ws` platform. The gateway is located in `src/modules/websocket/review.gateway.ts`.

## Rollback Procedure
If critical issues are found, the legacy Express backend is maintained in the `legacy-express` branch.
1. Switch to `legacy-express` branch.
2. Run `yarn install`.
3. Run `yarn start`.
