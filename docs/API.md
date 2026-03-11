# API Documentation

The PR Review Agent backend provides a REST API and WebSocket gateway for the Electron frontend.

**Base URL**: `http://localhost:3000/api`

## Authentication
All requests must include an `X-API-Key` header.
In development, the default key is `dev-key`.

## Endpoints

### 1. Pull Requests (`/prs`)
- `GET /prs`: List all pull requests from the database.
- `GET /prs/scan`: Scan GitHub for open PRs and sync with the database.
- `GET /prs/:repo/:number`: Get detailed info for a specific PR.
- `POST /prs/:repo/:number/review`: Manually trigger a review for a PR.

### 2. Reviews (`/reviews`)
- `GET /reviews`: List recent review sessions.
- `GET /reviews/:id`: Get details of a specific review session (including comments and metrics).
- `POST /reviews/run-once`: Trigger a one-time scan and review of all open PRs.

### 3. Metrics (`/metrics`)
- `GET /metrics/overview`: Get global quality and performance stats.
- `GET /metrics/pr/:number`: Get metrics for a specific PR.
- `GET /metrics/developer/:username`: Get performance metrics for a specific developer.

### 4. Team (`/team`)
- `GET /team/security`: Get recent security alerts and developer list.
- `GET /team/workload`: Get workload and experience levels for all developers.
- `PUT /team/developers/:id/availability`: Set developer availability status.

### 5. Configuration (`/config`)
- `GET /config/:repo`: Get configuration for a specific repository.
- `PUT /config/:repo`: Update configuration for a specific repository.

### 6. Health (`/health`)
- `GET /health`: Check backend server status.

## WebSocket Events
The WebSocket gateway is available at `ws://localhost:3000/api/ws`.

| Event Type | Description |
|------------|-------------|
| `review_started` | Emitted when a new review session starts. |
| `review_progress` | Emitted during various steps of the review (e.g., cloning, diffing). |
| `review_completed` | Emitted when a review finishes successfully. |
| `review_failed` | Emitted when a review session fails. |
| `metrics_updated` | Emitted when new metrics are calculated. |
