# Source Code Structure

This directory contains both the existing Express backend (JavaScript ES modules) and the new NestJS backend (TypeScript) during the migration period.

## Directory Organization

### NestJS Structure (TypeScript)

- **`modules/`** - Feature modules organized by domain
  - Each module contains controllers, services, and related components
  - Examples: ReviewModule, PullRequestModule, GitHubModule, AiModule, etc.

- **`common/`** - Shared utilities and cross-cutting concerns
  - Decorators
  - Guards
  - Interceptors
  - Filters
  - Pipes
  - Utility functions

- **`config/`** - Configuration modules and schemas
  - Environment configuration
  - Validation schemas
  - Repository-specific overrides

- **`database/`** - Database entities and repositories
  - TypeORM entities
  - Custom repositories
  - Database module configuration

### Existing Express Structure (JavaScript)

All `.js` files in the root `src/` directory are part of the existing Express implementation:
- Core services (review-engine.js, github.js, etc.)
- API routes in `routes/` directory
- Database management (database.js)
- Configuration (config.js)
- Logging (logger.js)

## Import Patterns

### NestJS (TypeScript)
```typescript
// Using path aliases
import { SomeService } from '@/modules';
import { SomeGuard } from '@/common';
import { AppConfig } from '@/config';
import { SomeEntity } from '@/database';
```

### Express (JavaScript ES Modules)
```javascript
// Relative imports with .js extension
import { dbManager } from './database.js';
import { config } from './config.js';
```

## Migration Strategy

The migration follows a gradual approach:
1. NestJS structure is set up alongside existing Express code
2. Modules are migrated one by one from Express to NestJS
3. Both systems can coexist during the transition
4. Once migration is complete, Express code will be removed

## Barrel Exports

Each major directory has an `index.ts` file for clean imports:
- `modules/index.ts` - Export all feature modules
- `common/index.ts` - Export all common utilities
- `config/index.ts` - Export all configuration modules
- `database/index.ts` - Export all entities and repositories

This allows for clean imports like:
```typescript
import { ReviewModule, PullRequestModule } from '@/modules';
```

Instead of:
```typescript
import { ReviewModule } from '@/modules/review/review.module';
import { PullRequestModule } from '@/modules/pull-request/pull-request.module';
```
