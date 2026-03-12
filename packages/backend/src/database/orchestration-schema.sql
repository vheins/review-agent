-- ============================================================================
-- PR Review Agent - Orchestration Database Schema
-- ============================================================================
-- This schema defines the tables required for deterministic orchestration,
-- role-based execution, policy enforcement, and mission tracking.
--
-- Requirements: 6.1, 12.1, 13.1
-- ============================================================================

-- Mission Sessions
-- Tracks the lifecycle of a high-level mission for a PR
CREATE TABLE mission_sessions (
  id TEXT PRIMARY KEY, -- UUID
  pr_id INTEGER NOT NULL,
  repository_id INTEGER NOT NULL,
  runbook_type TEXT NOT NULL, -- review-only, test-and-heal, fix-safe, full-auto, security-triage
  status TEXT NOT NULL, -- running, paused, awaiting_human, completed, failed, cancelled
  current_role TEXT, -- Scout, Reviewer, Fixer, Verifier, Merger
  current_step_id TEXT,
  operation_mode TEXT NOT NULL, -- observe, review-only, fix-safe, full-auto
  started_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  completed_at DATETIME,
  failure_reason TEXT,
  metadata TEXT, -- JSON
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id),
  FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

CREATE INDEX idx_mission_status ON mission_sessions(status);
CREATE INDEX idx_mission_pr ON mission_sessions(pr_id);
CREATE INDEX idx_mission_repo ON mission_sessions(repository_id);

-- Mission Steps
-- Tracks individual steps within a mission session
CREATE TABLE mission_steps (
  id TEXT PRIMARY KEY, -- UUID
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL, -- pending, running, completed, failed, skipped
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  metadata TEXT, -- JSON
  FOREIGN KEY (session_id) REFERENCES mission_sessions(id)
);

CREATE INDEX idx_step_session ON mission_steps(session_id);

-- Queue Scores
-- Persists scoring factors for PR prioritization
CREATE TABLE queue_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL UNIQUE,
  repository_id INTEGER NOT NULL,
  total_score REAL NOT NULL,
  factor_age REAL DEFAULT 0,
  factor_sla REAL DEFAULT 0,
  factor_severity REAL DEFAULT 0,
  factor_blocking REAL DEFAULT 0,
  factor_criticality REAL DEFAULT 0,
  factor_health REAL DEFAULT 0,
  factor_memory REAL DEFAULT 0,
  calculated_at DATETIME NOT NULL,
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id),
  FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

CREATE INDEX idx_queue_score ON queue_scores(total_score DESC);
CREATE INDEX idx_queue_repo ON queue_scores(repository_id);

-- Session Ledger Entries
-- Immutable append-only log of all mission events
CREATE TABLE session_ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- role_transition, step_start, step_complete, confidence_score, human_override, interruption, recovery
  actor TEXT NOT NULL, -- system, human, agent_role
  description TEXT NOT NULL,
  metadata TEXT, -- JSON (contains evidence, results, confidence breakdown)
  timestamp DATETIME NOT NULL,
  FOREIGN KEY (session_id) REFERENCES mission_sessions(id)
);

CREATE INDEX idx_ledger_session ON session_ledger_entries(session_id, timestamp);
CREATE INDEX idx_ledger_type ON session_ledger_entries(event_type);

-- Override Inbox Items
-- Items requiring human operator intervention
CREATE TABLE override_inbox_items (
  id TEXT PRIMARY KEY, -- UUID
  session_id TEXT NOT NULL,
  reason TEXT NOT NULL, -- low_confidence, forbidden_action, unexpected_error, policy_violation
  status TEXT NOT NULL, -- pending, resolved, deferred
  resolver_id INTEGER,
  resolution_action TEXT, -- approve, reject, reroute, defer
  resolution_notes TEXT,
  created_at DATETIME NOT NULL,
  resolved_at DATETIME,
  metadata TEXT, -- JSON (context for the operator)
  FOREIGN KEY (session_id) REFERENCES mission_sessions(id),
  FOREIGN KEY (resolver_id) REFERENCES developers(id)
);

CREATE INDEX idx_inbox_status ON override_inbox_items(status);
CREATE INDEX idx_inbox_session ON override_inbox_items(session_id);

-- Repository Memory Entries
-- Captures long-term context and patterns for a repository
CREATE TABLE repository_memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL,
  memory_type TEXT NOT NULL, -- recurring_issue, hot_file, preferred_reviewer, unstable_check, policy_hint
  content TEXT NOT NULL,
  importance REAL DEFAULT 1.0, -- for decay calculations
  last_observed_at DATETIME NOT NULL,
  observed_count INTEGER DEFAULT 1,
  expires_at DATETIME,
  metadata TEXT, -- JSON
  FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

CREATE INDEX idx_repo_memory ON repository_memory_entries(repository_id, memory_type);

-- Focus Windows
-- Scheduled windows for specific operation behaviors
CREATE TABLE focus_windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER, -- NULL for global windows
  name TEXT NOT NULL,
  start_time TEXT NOT NULL, -- Cron format or specific window
  end_time TEXT NOT NULL,
  bias_weight REAL DEFAULT 1.0,
  runbook_override TEXT,
  mode_override TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

CREATE INDEX idx_focus_repo ON focus_windows(repository_id, is_active);

-- ============================================================================
-- End of Orchestration Schema
-- ============================================================================
