# Migration Validator CLI

The `migration-validator` is a tool designed to verify the complete migration of the Review Agent from legacy Express.js to NestJS.

## Usage

```bash
npx ts-node packages/backend/src/migration/migration-validator.cli.ts validate [options]
```

### Options

- `-v, --verbose`: Display detailed validation results, including file mappings and sub-system status.
- `-f, --format <format>`: Output format. Supported formats: `text` (default), `json`, `markdown`.
- `-o, --output <dir>`: Output directory for reports. Default: `reports/migration`.

## Validation Checks

The validator performs the following checks:

1. **Legacy File Mapping**: Verifies all 64 legacy files have corresponding NestJS modules.
2. **Import Reference Scan**: Scans the codebase for any remaining imports from the `legacy/` directory.
3. **Route Migration**: Ensures all Express routes have been migrated to NestJS controllers.
4. **Test Coverage**: Checks if migrated modules have corresponding unit/integration tests.
5. **Database Layer**: Verifies TypeORM entity definitions and schema synchronization.
6. **Config Migration**: Ensures `@nestjs/config` and validation schemas are used.
7. **Sub-system Verification**: Validates migration of WebSockets, AI Executors, Review Engine, etc.

## Reports

When using the `markdown` format, two files are generated:

1. `migration-report.md`: A comprehensive overview of the migration status.
2. `removal-checklist.md`: A checklist that must be completed before the `legacy/` folder can be safely removed.

## Exit Codes

- `0`: Migration is complete and verified.
- `1`: Migration is incomplete (some checks failed).
- `3`: Validation process error.
