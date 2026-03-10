-- ============================================================================
-- PR Review Agent - Database Schema
-- ============================================================================
-- This schema defines the complete database structure for the PR Review Agent
-- enhancements, including analytics, team management, quality control, security,
-- and compliance features.
--
-- Requirements: 41.1, 41.2
-- ============================================================================

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Pull Requests
-- Stores information about pull requests being reviewed
CREATE TABLE pull_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_pr_id INTEGER NOT NULL UNIQUE,
  repository_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_branch TEXT NOT NULL,
  target_branch TEXT NOT NULL,
  status TEXT NOT NULL, -- open, merged, closed, rejected
  priority_score INTEGER DEFAULT 0,
  health_score INTEGER,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  merged_at DATETIME,
  time_to_merge_seconds INTEGER,
  is_blocking BOOLEAN DEFAULT 0,
  review_level TEXT, -- strict, standard, relaxed
  lock_version INTEGER DEFAULT 0, -- for optimistic locking
  FOREIGN KEY (repository_id) REFERENCES repositories(id),
  FOREIGN KEY (author_id) REFERENCES developers(id)
);

CREATE INDEX idx_pr_status ON pull_requests(status);
CREATE INDEX idx_pr_created ON pull_requests(created_at);
CREATE INDEX idx_pr_priority ON pull_requests(priority_score DESC);
CREATE INDEX idx_pr_author ON pull_requests(author_id);
CREATE INDEX idx_pr_repo ON pull_requests(repository_id);

-- PR Reviewers
-- Tracks assigned human reviewers and their review status
CREATE TABLE pr_reviewers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL,
  developer_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, changes_requested
  assigned_at DATETIME NOT NULL,
  completed_at DATETIME,
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id),
  FOREIGN KEY (developer_id) REFERENCES developers(id),
  UNIQUE(pr_id, developer_id)
);

CREATE INDEX idx_pr_reviewer ON pr_reviewers(developer_id, status);

-- Review Sessions
-- Tracks individual review executions by AI executors
CREATE TABLE review_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL,
  executor_type TEXT NOT NULL, -- gemini, copilot, kiro, claude, codex, opencode
  status TEXT NOT NULL, -- pending, processing, completed, failed, cancelled
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  duration_seconds INTEGER,
  outcome TEXT, -- approved, rejected, needs_changes
  rejection_reasons TEXT, -- JSON array
  quality_score INTEGER,
  false_positive_count INTEGER DEFAULT 0,
  lock_timestamp DATETIME, -- for task locking
  lock_owner TEXT, -- instance ID that owns the lock
  retry_count INTEGER DEFAULT 0,
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id)
);

CREATE INDEX idx_review_pr ON review_sessions(pr_id);
CREATE INDEX idx_review_status ON review_sessions(status);
CREATE INDEX idx_review_executor ON review_sessions(executor_type);
CREATE INDEX idx_review_lock ON review_sessions(lock_timestamp, lock_owner);

-- Review Comments
-- Stores individual review comments and findings
CREATE TABLE review_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_session_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- error, warning, info
  message TEXT NOT NULL,
  code_snippet TEXT,
  suggested_fix TEXT,
  is_auto_fixable BOOLEAN DEFAULT 0,
  is_resolved BOOLEAN DEFAULT 0,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (review_session_id) REFERENCES review_sessions(id)
);

CREATE INDEX idx_comment_session ON review_comments(review_session_id);
CREATE INDEX idx_comment_type ON review_comments(issue_type);

-- ============================================================================
-- Team Management Tables
-- ============================================================================

-- Developers
-- Stores developer information and preferences
CREATE TABLE developers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_username TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'developer', -- developer, lead, manager, admin
  is_available BOOLEAN DEFAULT 1,
  unavailable_until DATETIME,
  current_workload_score REAL DEFAULT 0,
  notification_preferences TEXT, -- JSON
  gamification_enabled BOOLEAN DEFAULT 0,
  gamification_points INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE INDEX idx_dev_username ON developers(github_username);
CREATE INDEX idx_dev_workload ON developers(current_workload_score);

-- Repositories
-- Stores repository configuration and metadata
CREATE TABLE repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_repo_id INTEGER NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  sla_hours INTEGER DEFAULT 24,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE(owner, name)
);

CREATE INDEX idx_repo_full_name ON repositories(full_name);

-- Expertise Areas
-- Tracks developer expertise in different code areas
CREATE TABLE expertise_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  developer_id INTEGER NOT NULL,
  file_pattern TEXT NOT NULL,
  expertise_score REAL NOT NULL,
  last_contribution_at DATETIME NOT NULL,
  contribution_count INTEGER DEFAULT 1,
  FOREIGN KEY (developer_id) REFERENCES developers(id),
  UNIQUE(developer_id, file_pattern)
);

CREATE INDEX idx_expertise_dev ON expertise_areas(developer_id);
CREATE INDEX idx_expertise_pattern ON expertise_areas(file_pattern);

-- ============================================================================
-- Analytics & Metrics Tables
-- ============================================================================

-- PR Metrics
-- Stores time-series metrics for pull requests
CREATE TABLE pr_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_unit TEXT,
  recorded_at DATETIME NOT NULL,
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id)
);

CREATE INDEX idx_metric_pr ON pr_metrics(pr_id);
CREATE INDEX idx_metric_type ON pr_metrics(metric_type, recorded_at);

-- Developer Metrics
-- Stores aggregated developer performance metrics
CREATE TABLE developer_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  developer_id INTEGER NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value REAL NOT NULL,
  time_period TEXT NOT NULL, -- daily, weekly, monthly
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  FOREIGN KEY (developer_id) REFERENCES developers(id)
);

CREATE INDEX idx_dev_metric ON developer_metrics(developer_id, metric_type, period_start);

-- ============================================================================
-- Quality Control Tables
-- ============================================================================

-- Custom Rules
-- Stores team-specific coding standards and checks
CREATE TABLE custom_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- regex, ast
  pattern TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  auto_fixable BOOLEAN DEFAULT 0,
  auto_fix_template TEXT,
  enabled BOOLEAN DEFAULT 1,
  branch_patterns TEXT, -- JSON array
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

CREATE INDEX idx_rule_repo ON custom_rules(repository_id, enabled);

-- False Positives
-- Tracks review comments marked as incorrect
CREATE TABLE false_positives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  marked_by_developer_id INTEGER NOT NULL,
  justification TEXT NOT NULL,
  marked_at DATETIME NOT NULL,
  FOREIGN KEY (comment_id) REFERENCES review_comments(id),
  FOREIGN KEY (marked_by_developer_id) REFERENCES developers(id)
);

CREATE INDEX idx_fp_comment ON false_positives(comment_id);

-- Checklists
-- Stores checklist templates
CREATE TABLE checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER, -- NULL for global checklists
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

-- Checklist Items
-- Stores individual items in a checklist
CREATE TABLE checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL,
  item_text TEXT NOT NULL,
  priority TEXT DEFAULT 'normal', -- high, normal, low
  category TEXT,
  FOREIGN KEY (checklist_id) REFERENCES checklists(id)
);

-- Review Checklists
-- Tracks completion of checklists for specific reviews
CREATE TABLE review_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_session_id INTEGER NOT NULL,
  checklist_item_id INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT 0,
  completed_at DATETIME,
  completed_by_developer_id INTEGER,
  notes TEXT,
  FOREIGN KEY (review_session_id) REFERENCES review_sessions(id),
  FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(id),
  FOREIGN KEY (completed_by_developer_id) REFERENCES developers(id),
  UNIQUE(review_session_id, checklist_item_id)
);

CREATE INDEX idx_review_checklist_session ON review_checklists(review_session_id);

-- Orchestration Sets
-- Groups related PRs for coordinated review
CREATE TABLE orchestration_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
  created_at DATETIME NOT NULL,
  completed_at DATETIME
);

-- Orchestration Set Members
CREATE TABLE orchestration_set_members (
  set_id TEXT NOT NULL,
  pr_id INTEGER NOT NULL,
  dependency_pr_id INTEGER, -- PR that must be reviewed first
  FOREIGN KEY (set_id) REFERENCES orchestration_sets(id),
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id),
  PRIMARY KEY (set_id, pr_id)
);

-- Review Templates
-- Stores reusable review comment templates
CREATE TABLE review_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- security, quality, style, logic
  template_text TEXT NOT NULL,
  placeholders TEXT, -- JSON array of supported placeholders
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE INDEX idx_template_category ON review_templates(category);

-- ============================================================================
-- Security & Compliance Tables
-- ============================================================================

-- Security Findings
-- Stores security vulnerabilities and compliance issues
CREATE TABLE security_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL,
  finding_type TEXT NOT NULL, -- vulnerability, license, sensitive_data
  severity TEXT NOT NULL, -- critical, high, medium, low
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  remediation TEXT,
  cve_id TEXT,
  is_resolved BOOLEAN DEFAULT 0,
  detected_at DATETIME NOT NULL,
  resolved_at DATETIME,
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id)
);

CREATE INDEX idx_finding_pr ON security_findings(pr_id);
CREATE INDEX idx_finding_type ON security_findings(finding_type, severity);

-- Audit Trail
-- Immutable log of all automated actions for compliance
CREATE TABLE audit_trail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME NOT NULL,
  action_type TEXT NOT NULL,
  actor_type TEXT NOT NULL, -- user, system
  actor_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action_details TEXT NOT NULL, -- JSON
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_audit_timestamp ON audit_trail(timestamp);
CREATE INDEX idx_audit_resource ON audit_trail(resource_type, resource_id);
CREATE INDEX idx_audit_actor ON audit_trail(actor_type, actor_id);

-- ============================================================================
-- Self-Healing & Automation Tables
-- ============================================================================

-- Auto-Fix Attempts
-- Tracks automated fix attempts for rejected PRs
CREATE TABLE auto_fix_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL,
  review_session_id INTEGER,
  attempt_number INTEGER NOT NULL,
  issues_targeted TEXT NOT NULL, -- JSON array
  fixes_applied TEXT NOT NULL, -- JSON array
  commit_sha TEXT,
  test_passed BOOLEAN,
  status TEXT NOT NULL, -- success, failed, rolled_back
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  error_message TEXT,
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id),
  FOREIGN KEY (review_session_id) REFERENCES review_sessions(id)
);

CREATE INDEX idx_autofix_pr ON auto_fix_attempts(pr_id);

-- Test Runs
-- Tracks test execution and healing attempts
CREATE TABLE test_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL,
  run_type TEXT NOT NULL, -- initial, post_heal, post_fix
  status TEXT NOT NULL, -- passed, failed, error
  test_results TEXT NOT NULL, -- JSON
  failures_detected TEXT, -- JSON array
  heal_attempted BOOLEAN DEFAULT 0,
  heal_successful BOOLEAN,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  duration_seconds INTEGER,
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id)
);

CREATE INDEX idx_test_pr ON test_runs(pr_id);
CREATE INDEX idx_test_status ON test_runs(status, started_at);

-- ============================================================================
-- Communication Tables
-- ============================================================================

-- Notifications
-- Stores notification queue and delivery status
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL, -- low, normal, high, urgent
  related_pr_id INTEGER,
  related_review_id INTEGER,
  data TEXT, -- JSON
  is_read BOOLEAN DEFAULT 0,
  is_batched BOOLEAN DEFAULT 0,
  batch_id TEXT,
  created_at DATETIME NOT NULL,
  sent_at DATETIME,
  FOREIGN KEY (recipient_id) REFERENCES developers(id)
);

CREATE INDEX idx_notif_recipient ON notifications(recipient_id, is_read);
CREATE INDEX idx_notif_batch ON notifications(batch_id);

-- Discussion Threads
-- Tracks comment threads on pull requests
CREATE TABLE pr_discussions (
  id TEXT PRIMARY KEY,
  pr_id INTEGER NOT NULL,
  github_thread_id TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open, resolved
  is_resolved BOOLEAN DEFAULT 0,
  resolved_at DATETIME,
  resolved_by_developer_id INTEGER,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id),
  FOREIGN KEY (author_id) REFERENCES developers(id),
  FOREIGN KEY (resolved_by_developer_id) REFERENCES developers(id)
);

CREATE INDEX idx_discussion_pr ON pr_discussions(pr_id, status);

-- Achievements
-- Stores achievement definitions and awards
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  points_reward INTEGER DEFAULT 0
);

-- Developer Achievements
CREATE TABLE developer_achievements (
  developer_id INTEGER NOT NULL,
  achievement_id TEXT NOT NULL,
  awarded_at DATETIME NOT NULL,
  FOREIGN KEY (developer_id) REFERENCES developers(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id),
  PRIMARY KEY (developer_id, achievement_id)
);

-- ============================================================================
-- Configuration Tables
-- ============================================================================

-- Configuration Tables
-- Stores per-repository configuration settings
CREATE TABLE repository_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL UNIQUE,
  config_data TEXT NOT NULL, -- JSON
  version INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

-- Export Metadata
-- Tracks generated data exports
CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- csv, json
  resource_type TEXT NOT NULL, -- metrics, reviews
  filters TEXT, -- JSON
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  created_by TEXT
);

CREATE INDEX idx_export_created ON exports(created_at);
CREATE INDEX idx_export_expires ON exports(expires_at);

-- ============================================================================
-- End of Schema
-- ============================================================================
