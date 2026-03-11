# Project Structure

## Root Directory Layout

```
pr-review-agent/
├── src/                    # Backend source code (ES modules)
├── electron/               # Desktop app (Electron + React)
├── tests/                  # Test suites (Vitest)
├── context/                # AI prompt templates
├── data/                   # SQLite database files
├── logs/                   # Daily log files (7-day retention)
├── workspace/              # Cloned repositories for review
├── .kiro/                  # Kiro configuration
├── .agents/                # Agent artifacts and documentation
├── .env                    # Environment configuration
└── package.json            # Dependencies and scripts
```

## Source Code Organization (`src/`)

### Core Services
- `index.js` - Main entry point for continuous/once mode
- `server.js` - REST API + WebSocket server entry point
- `api-server.js` - Express app setup and middleware
- `config.js` - Configuration management with repo overrides
- `database.js` - SQLite database manager (singleton)
- `logger.js` - Logging with daily rotation

### Review Engine
- `review-engine.js` - Core review logic and orchestration
- `review-pr.js` - Single PR review CLI
- `comment-parser.js` - Parse AI review output into structured comments
- `checklist-manager.js` - Review checklist generation and tracking

### AI Integration
- `ai-executors.js` - Multi-executor support (Gemini, Copilot, Kiro, etc.)
- `ai-fix-generator.js` - Auto-fix generation from review comments
- `delegate.js` - AI delegation orchestration

### GitHub Integration
- `github-client.js` - GitHub API wrapper
- `ci-integration.js` - CI/CD status checks
- `auto-merge-service.js` - Automated PR merging logic
- `auto-fix-service.js` - Automated fix application

### Metrics & Analytics
- `metrics-collector.js` - Collect review metrics
- `health-score-calculator.js` - Calculate PR health scores
- `quality-scorer.js` - Code quality scoring
- `coverage-tracker.js` - Test coverage tracking
- `performance-alert-service.js` - Performance monitoring

### Team & Developer Features
- `developer-dashboard.js` - Developer metrics aggregation
- `assignment-engine.js` - Reviewer assignment logic
- `capacity-planner.js` - Team capacity planning
- `gamification-engine.js` - Developer engagement features
- `feedback-analyzer.js` - Review feedback analysis

### Security & Compliance
- `security-scanner.js` - Security vulnerability detection
- `dependency-scanner.js` - Dependency analysis
- `compliance-reporter.js` - Compliance reporting
- `audit-logger.js` - Audit trail logging

### Utilities
- `error-handler.js` - Global error handling
- `websocket-server.js` - WebSocket manager for real-time updates
- `batch-processor.js` - Batch processing utilities
- `data-exporter.js` - Export data to CSV/JSON
- `email-delivery-service.js` - Email notifications
- `elapsed-time-tracker.js` - Time tracking utilities

### API Routes (`src/routes/`)
- `prs.js` - Pull request endpoints
- `reviews.js` - Review session endpoints
- `metrics.js` - Metrics and analytics endpoints
- `team.js` - Team and developer endpoints
- `security.js` - Security scan endpoints
- `config.js` - Configuration endpoints
- `health.js` - Health check endpoints
- `webhooks.js` - GitHub webhook handlers

### Database
- `database/schema.sql` - SQLite schema definition

## Electron App (`electron/`)

### Main Process (CommonJS)
- `main.cjs` - Electron main process, window management, backend auto-start
- `preload.cjs` - IPC bridge between main and renderer

### Renderer Process (ES Modules + React)
- `app.jsx` - Main React application component
- `renderer.js` - Renderer entry point
- `index.html` - HTML template
- `styles.css` - Global styles
- `vite.config.mjs` - Vite build configuration

### UI Components (`electron/components/ui/`)
- `badge.jsx` - Badge component
- `button.jsx` - Button component
- `card.jsx` - Card component
- `input.jsx` - Input component
- `select.jsx` - Select component
- `textarea.jsx` - Textarea component

### Utilities
- `api-client.cjs` - API client for backend communication
- `api-helper.js` - API helper functions
- `lib/utils.js` - Utility functions (cn, etc.)

### Testing
- `testing/mock-dashboard-data.cjs` - Mock data for testing

## Tests (`tests/`)

Test files mirror source structure with `.test.js` suffix:
- `review-engine.test.js` - Review engine tests
- `assignment.test.js` - Assignment logic tests
- `auto-fix.test.js` - Auto-fix tests
- `database.test.js` - Database tests
- `config.test.js` - Configuration tests
- etc.

### E2E Tests (`playwright/`)
- `electron-ui.spec.js` - Electron UI tests
- `sticky-navigation.spec.js` - Navigation tests

## Context Files (`context/`)

AI prompt templates:
- `review-prompt.md` - Review guidelines for AI
- `fix-prompt.md` - Fix generation guidelines

## Configuration Files

### Environment
- `.env` - Environment variables (not committed)
- `.env.example` - Environment template

### Build & Tools
- `package.json` - Dependencies and scripts
- `electron-builder.json` - Electron build configuration
- `vite.config.mjs` - Vite configuration (Electron)
- `tailwind.config.cjs` - Tailwind CSS configuration
- `postcss.config.cjs` - PostCSS configuration
- `playwright.config.mjs` - Playwright test configuration
- `nodemon.json` - Nodemon watch configuration

### Kiro
- `.kiro/steering/` - Steering rules for AI assistance
- `.kiro/specs/` - Feature specifications

## Naming Conventions

### Files
- Backend: `kebab-case.js` (ES modules)
- Electron main/preload: `kebab-case.cjs` (CommonJS)
- React components: `kebab-case.jsx`
- Tests: `kebab-case.test.js`
- Config: `kebab-case.{js,cjs,mjs,json}`

### Code
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Singletons: `camelCase` (e.g., `dbManager`, `configManager`)

## Import Patterns

### Backend (ES Modules)
```javascript
import { dbManager } from './database.js';
import { config } from './config.js';
import express from 'express';
```

### Electron Main (CommonJS)
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
```

### React Components
```javascript
import React from 'react';
import { Button } from './components/ui/button';
```

## Singleton Pattern

Key singletons exported from modules:
- `dbManager` - Database manager
- `configManager` - Configuration manager
- `wsManager` - WebSocket manager
- `apiServer` - API server instance
- `reviewEngine` - Review engine
- `logger` - Logger instance

Import and use directly:
```javascript
import { dbManager } from './database.js';
dbManager.db.prepare('SELECT * FROM users').all();
```
