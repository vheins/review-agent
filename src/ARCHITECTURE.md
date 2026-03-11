# NestJS Backend Architecture

This document describes the architecture and organization of the NestJS backend for PR Review Agent.

## Folder Structure

```
src/
├── app.module.ts           # Root NestJS module
├── main.ts                 # Application entry point
├── index.ts                # Root barrel export
├── modules/                # Feature modules
│   ├── index.ts           # Modules barrel export
│   ├── review/            # Review module (to be created)
│   ├── pull-request/      # Pull request module (to be created)
│   ├── github/            # GitHub integration module (to be created)
│   ├── ai/                # AI executor module (to be created)
│   ├── metrics/           # Metrics module (to be created)
│   ├── team/              # Team module (to be created)
│   ├── security/          # Security module (to be created)
│   └── websocket/         # WebSocket module (to be created)
├── common/                 # Shared utilities
│   ├── index.ts           # Common barrel export
│   ├── decorators/        # Custom decorators (to be created)
│   ├── guards/            # Auth guards (to be created)
│   ├── interceptors/      # Interceptors (to be created)
│   ├── filters/           # Exception filters (to be created)
│   ├── pipes/             # Validation pipes (to be created)
│   ├── utils/             # Utility functions (to be created)
│   ├── interfaces/        # Shared interfaces (to be created)
│   └── constants/         # Constants (to be created)
├── database/               # Database layer
│   ├── index.ts           # Database barrel export
│   ├── entities/          # TypeORM entities (to be created)
│   ├── database.module.ts # TypeORM module config (to be created)
│   └── schema.sql         # Legacy SQL schema (reference)
└── config/                 # Configuration
    ├── index.ts           # Config barrel export
    ├── app.config.ts      # App configuration (to be created)
    ├── database.config.ts # Database configuration (to be created)
    ├── validation.schema.ts # Validation schemas (to be created)
    └── config.module.ts   # ConfigModule setup (to be created)
```

## Module Organization

### AppModule (Root Module)

The `AppModule` is the root module that imports all feature modules and configures global providers.

**Location:** `src/app.module.ts`

**Responsibilities:**
- Import all feature modules
- Configure global modules (ConfigModule, DatabaseModule, LoggerModule)
- Setup WebSocket gateway
- Apply global guards, interceptors, and filters

### Feature Modules

Feature modules encapsulate specific business domains:

1. **ReviewModule** - Review orchestration and management
2. **PullRequestModule** - Pull request operations
3. **GitHubModule** - GitHub API integration
4. **AiModule** - AI executor management
5. **MetricsModule** - Metrics collection and analytics
6. **TeamModule** - Team and developer features
7. **SecurityModule** - Security scanning and compliance
8. **WebSocketModule** - Real-time updates via WebSocket

Each feature module follows this structure:
```
module-name/
├── module-name.module.ts      # Module definition
├── module-name.controller.ts  # REST API controller
├── module-name.service.ts     # Business logic service
├── dto/                       # Data Transfer Objects
│   ├── create-*.dto.ts
│   └── update-*.dto.ts
└── interfaces/                # Module-specific interfaces
    └── *.interface.ts
```

### Common Utilities

The `common/` directory contains shared functionality used across modules:

- **decorators/** - Custom decorators for metadata
- **guards/** - Authentication and authorization guards
- **interceptors/** - Request/response interceptors (logging, transformation)
- **filters/** - Exception filters for error handling
- **pipes/** - Validation and transformation pipes
- **utils/** - Utility functions
- **interfaces/** - Shared TypeScript interfaces
- **constants/** - Application constants

### Database Layer

The `database/` directory contains TypeORM configuration and entities:

- **entities/** - TypeORM entity classes defining database schema
- **database.module.ts** - TypeORM module configuration
- **schema.sql** - Legacy SQL schema (for reference only)

TypeORM will auto-create/sync the database schema from entity classes.

### Configuration

The `config/` directory contains application configuration:

- **app.config.ts** - Application-level configuration
- **database.config.ts** - Database connection configuration
- **validation.schema.ts** - Configuration validation schemas
- **config.module.ts** - NestJS ConfigModule setup

## Barrel Exports

Each directory has an `index.ts` file that serves as a barrel export, providing clean imports:

```typescript
// Instead of:
import { ReviewService } from './modules/review/review.service';
import { PullRequestService } from './modules/pull-request/pull-request.service';

// Use:
import { ReviewService, PullRequestService } from '@/modules';
```

Path aliases are configured in `tsconfig.json`:
- `@/*` - Root src directory
- `@modules/*` - Modules directory
- `@common/*` - Common directory
- `@database/*` - Database directory
- `@config/*` - Config directory

## Dependency Injection

NestJS uses dependency injection throughout:

```typescript
@Injectable()
export class ReviewService {
  constructor(
    private readonly githubService: GitHubService,
    private readonly aiService: AiService,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}
}
```

## Module Imports

Modules are imported in `AppModule`:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LoggerModule,
    ReviewModule,
    PullRequestModule,
    // ... other modules
  ],
})
export class AppModule {}
```

## Next Steps

The following tasks will populate this structure:

1. **Phase 1** - Setup TypeORM with entities and ConfigModule
2. **Phase 2** - Migrate core services (GitHub, AI, Logger)
3. **Phase 3** - Migrate review engine
4. **Phase 4** - Implement REST API controllers
5. **Phase 5** - Migrate additional services
6. **Phase 6** - Electron integration
7. **Phase 7** - Testing and validation
8. **Phase 8** - Documentation and deployment

## Running the Application

### Development Mode
```bash
yarn backend:dev
```

### Production Build
```bash
yarn backend:build
yarn backend:start
```

### Testing
```bash
yarn test
```

## Architecture Principles

1. **Modular Design** - Each feature is self-contained in its own module
2. **Dependency Injection** - Loose coupling through DI
3. **Type Safety** - TypeScript for compile-time type checking
4. **Clean Imports** - Barrel exports for organized imports
5. **Separation of Concerns** - Controllers, services, and repositories have distinct roles
6. **Testability** - DI makes unit testing straightforward
