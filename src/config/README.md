# Configuration Module

This module provides typed configuration management for the PR Review Agent backend using NestJS ConfigModule.

## Features

- ✅ Global configuration service available throughout the application
- ✅ Type-safe configuration access with TypeScript interfaces
- ✅ Environment variable validation using Joi schema
- ✅ Configuration namespaces for organized settings
- ✅ Default values for all configuration options
- ✅ Support for .env file loading

## Configuration Namespaces

### 1. App Configuration (`app`)

General application settings including server port, intervals, and workspace configuration.

```typescript
interface AppConfig {
  nodeEnv: string;
  apiPort: number;
  reviewInterval: number;
  logLevel: string;
  workspaceDir: string;
  excludeRepoOwners: string[];
  prScope: string[];
  autoMerge: boolean;
}
```

**Environment Variables:**
- `NODE_ENV` - Environment (development, production, test)
- `API_PORT` - Server port (default: 3000)
- `REVIEW_INTERVAL` - Review interval in seconds (default: 600)
- `LOG_LEVEL` - Logging level (error, warn, info, debug)
- `WORKSPACE_DIR` - Directory for cloned repositories
- `EXCLUDE_REPO_OWNERS` - Comma-separated list of repo owners to exclude
- `PR_SCOPE` - Comma-separated PR scope (authored, assigned, review-requested)
- `AUTO_MERGE` - Enable auto-merge (true/false)

### 2. Review Configuration (`review`)

Review-specific settings including mode and severity scoring.

```typescript
interface ReviewConfig {
  delegate: boolean;
  reviewMode: 'comment' | 'auto-fix';
  severityThreshold: number;
  severityCritical: number;
  severityHigh: number;
  severityMedium: number;
  severityLow: number;
}
```

**Environment Variables:**
- `DELEGATE` - Enable AI delegation (true/false)
- `REVIEW_MODE` - Review mode (comment, auto-fix)
- `SEVERITY_THRESHOLD` - Severity threshold score
- `SEVERITY_CRITICAL` - Critical severity score
- `SEVERITY_HIGH` - High severity score
- `SEVERITY_MEDIUM` - Medium severity score
- `SEVERITY_LOW` - Low severity score

### 3. AI Executor Configuration (`aiExecutor`)

AI executor settings for all supported executors.

```typescript
interface AiExecutorConfig {
  executor: string;
  gemini: ExecutorSettings;
  copilot: ExecutorSettings;
  kiro: ExecutorSettings;
  claude: ExecutorSettings;
  codex: ExecutorSettings;
  opencode: ExecutorSettings;
}

interface ExecutorSettings {
  enabled: boolean;
  model: string;
  yolo: boolean;
  agent?: string;
}
```

**Environment Variables:**
- `AI_EXECUTOR` - Current executor (gemini, copilot, kiro, claude, codex, opencode)
- `{EXECUTOR}_ENABLED` - Enable specific executor
- `{EXECUTOR}_MODEL` - Model/agent to use
- `{EXECUTOR}_YOLO` - Enable YOLO mode
- `{EXECUTOR}_AGENT` - Agent name (for some executors)

### 4. Database Configuration (`database`)

TypeORM database connection settings.

```typescript
interface DatabaseConfig {
  type: 'sqlite';
  database: string;
  synchronize: boolean;
  logging: boolean;
  autoLoadEntities: boolean;
}
```

## Usage

### Basic Usage

Inject `ConfigService` into your service:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyService {
  constructor(private readonly configService: ConfigService) {}

  someMethod() {
    // Get specific value
    const port = this.configService.get<number>('app.apiPort');
    
    // Get with default value
    const logLevel = this.configService.get('app.logLevel', 'info');
    
    // Get entire namespace
    const appConfig = this.configService.get<AppConfig>('app');
  }
}
```

### Type-Safe Access

Import configuration types for full type safety:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, ReviewConfig } from '@/config';

@Injectable()
export class MyService {
  constructor(private readonly configService: ConfigService) {}

  getAppConfig(): AppConfig {
    return this.configService.get<AppConfig>('app')!;
  }

  getReviewMode(): 'comment' | 'auto-fix' {
    const review = this.configService.get<ReviewConfig>('review')!;
    return review.reviewMode;
  }
}
```

### Accessing Nested Values

```typescript
// Get nested value directly
const geminiModel = this.configService.get<string>('aiExecutor.gemini.model');

// Or get parent and access property
const aiConfig = this.configService.get<AiExecutorConfig>('aiExecutor')!;
const isGeminiEnabled = aiConfig.gemini.enabled;
```

## Validation

Configuration is validated at application startup using Joi schema. If validation fails, the application will not start and will display validation errors.

Example validation error:
```
Error: Config validation error: "API_PORT" must be a valid port number
```

## Environment Files

### Development
Create a `.env` file in the project root:

```env
NODE_ENV=development
API_PORT=3000
REVIEW_INTERVAL=600
AI_EXECUTOR=gemini
GEMINI_ENABLED=true
```

### Production
In production, set environment variables directly (don't use .env file):

```bash
export NODE_ENV=production
export API_PORT=3000
export AI_EXECUTOR=gemini
```

## Adding New Configuration

To add new configuration:

1. **Add environment variable to `.env.example`**
2. **Update validation schema** in `validation.schema.ts`
3. **Add to appropriate config factory** (or create new one)
4. **Update TypeScript interface**
5. **Export from barrel** (`index.ts`)

Example:

```typescript
// 1. Add to validation.schema.ts
export const validationSchema = Joi.object({
  // ... existing
  NEW_SETTING: Joi.string().default('default-value'),
});

// 2. Add to config factory (e.g., app.config.ts)
export interface AppConfig {
  // ... existing
  newSetting: string;
}

export default registerAs('app', (): AppConfig => ({
  // ... existing
  newSetting: process.env.NEW_SETTING || 'default-value',
}));
```

## Testing

Mock ConfigService in tests:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config = {
      'app.apiPort': 3000,
      'app.logLevel': 'info',
      'review.reviewMode': 'comment',
    };
    return config[key];
  }),
};

const module = await Test.createTestingModule({
  providers: [
    MyService,
    {
      provide: ConfigService,
      useValue: mockConfigService,
    },
  ],
}).compile();
```

## Requirements

This configuration module satisfies the following requirements:
- **9.1**: ConfigModule implemented as NestJS ConfigModule
- **9.2**: Reads environment variables from .env file
- **9.4**: Validates configuration values at startup
- **9.5**: Provides typed configuration objects
