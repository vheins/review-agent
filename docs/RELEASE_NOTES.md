# Release Notes: v2.0.0 (NestJS Refactor)

We are excited to announce the complete refactor of the PR Review Agent backend to NestJS! This version brings significant improvements in performance, maintainability, and security.

## New Features

### 1. Modern NestJS Architecture
The backend has been completely rewritten using **NestJS**, **TypeScript**, and **TypeORM**. This provides a modular, well-structured codebase that is easier to extend and test.

### 2. Enhanced Security
- **Security Headers**: Integrated `helmet` for best-practice security headers.
- **Rate Limiting**: Added protection against brute-force and DoS attacks using `@nestjs/throttler`.
- **API Key Protection**: All endpoints are now secured via API Key authentication.

### 3. Improved Database Layer
Switched from raw SQL with `better-sqlite3` to **TypeORM** with SQLite.
- Automatic schema synchronization.
- Type-safe database operations.
- Better relationship management between entities.

### 4. Real-time Updates
The WebSocket implementation now uses standard NestJS Gateways, providing more reliable real-time broadcasting of review progress to the Electron frontend.

### 5. Advanced Metrics
- **Quality Scorer**: New logic to calculate AI review quality.
- **Health Score**: Improved PR health score calculation based on security findings and review comments.
- **Developer Dashboard**: Aggregated performance data for developers.

## Breaking Changes

### 1. API Prefix
All REST API endpoints now require the `/api` prefix (e.g., `http://localhost:3000/api/prs`).

### 2. TypeScript Migration
If you are developing custom modules, you must now use TypeScript.

## Upgrade Instructions

1. Pull the latest changes from the `master` branch.
2. Run `yarn install` to install new dependencies.
3. Update your `.env` file if necessary (refer to `.env.example`).
4. Run `yarn backend:build` to compile the new backend.
5. Start the app as usual with `yarn app:dev` or `yarn app`.

## Known Issues
- Full E2E testing in headless environments may require additional configuration.
