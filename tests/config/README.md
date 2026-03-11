# Configuration Tests

This directory contains comprehensive unit tests for the configuration loading system.

## Test Files

### 1. `app-config.service.test.ts` (27 tests)
Tests for the `AppConfigService` class that provides repository-specific configuration overrides.

**Coverage:**
- ✅ Configuration loading (`get`, `getAppConfig`, `getReviewConfig`, `getAiExecutorConfig`, `getDatabaseConfig`)
- ✅ Repository-specific overrides (`getRepositoryConfig`)
- ✅ Configuration validation (`validateConfig`)
- ✅ Caching behavior (cache hits, TTL, clearing)
- ✅ Version management (`getConfigVersion`, version incrementing)
- ✅ Default value handling (`createDefaultConfig`)
- ✅ Error handling (database errors, validation errors)
- ✅ Configuration persistence (`saveRepositoryConfig`)

**Key Test Scenarios:**
- Loading repository config from database
- Falling back to defaults when no repo-specific config exists
- Caching for performance (5-minute TTL)
- Validating configuration values (review mode, executor, scan scope, etc.)
- Incrementing version on updates
- Clearing cache after saves

### 2. `config-factories.test.ts` (23 tests)
Tests for configuration factory functions that load environment variables.

**Coverage:**
- ✅ Environment variable loading for all config namespaces
- ✅ Default value application when env vars not set
- ✅ Array parsing (PR_SCOPE, EXCLUDE_REPO_OWNERS)
- ✅ Boolean parsing (AUTO_MERGE, DELEGATE, executor flags)
- ✅ Number parsing (ports, intervals, severity scores)
- ✅ Whitespace trimming in array values
- ✅ All AI executor settings (Gemini, Copilot, Kiro, Claude, Codex, OpenCode)
- ✅ Database configuration (type, path, synchronize, logging)

**Test Coverage by Config Namespace:**
- `appConfig`: 8 tests
- `reviewConfig`: 4 tests
- `aiExecutorConfig`: 6 tests
- `databaseConfig`: 5 tests

### 3. `validation-schema.test.ts` (25 tests)
Tests for Joi validation schema that validates environment variables at startup.

**Coverage:**
- ✅ Valid value validation for all config fields
- ✅ Invalid value rejection with error messages
- ✅ Default value application
- ✅ Type coercion (string to number, string to boolean)
- ✅ Minimum/maximum value constraints
- ✅ Enum validation (NODE_ENV, REVIEW_MODE, AI_EXECUTOR, LOG_LEVEL)
- ✅ Port number validation
- ✅ Unknown variable handling (with allowUnknown option)
- ✅ Multiple error reporting (abortEarly: false)

**Test Coverage by Config Area:**
- Application Configuration: 8 tests
- Review Configuration: 5 tests
- AI Executor Configuration: 5 tests
- Default Values: 3 tests
- Validation Options: 2 tests
- Type Coercion: 2 tests

## Total Test Coverage

**75 tests** covering:
- ✅ Environment variable loading
- ✅ Repository-specific overrides
- ✅ Configuration validation
- ✅ Default values
- ✅ Caching behavior
- ✅ Version management
- ✅ Error handling
- ✅ Type coercion
- ✅ All configuration namespaces (app, review, aiExecutor, database)

## Running Tests

```bash
# Run all configuration tests
yarn test tests/config/ --run

# Run specific test file
yarn test tests/config/app-config.service.test.ts --run
yarn test tests/config/config-factories.test.ts --run
yarn test tests/config/validation-schema.test.ts --run
```

## Requirements Coverage

This test suite satisfies the following requirements from the NestJS backend refactor spec:

- **9.1**: Environment variable loading
- **9.2**: Typed configuration objects
- **9.3**: Repository-specific configuration overrides
- **9.4**: Configuration validation
- **9.5**: Default value handling
- **9.6**: Configuration versioning

## Test Quality

All tests follow best practices:
- ✅ Isolated test cases with proper setup/teardown
- ✅ Mocked external dependencies (database, ConfigService)
- ✅ Clear test descriptions
- ✅ Comprehensive edge case coverage
- ✅ Error scenario testing
- ✅ Type safety validation
