# Implementation Plan: PR Review Agent Enhancements

## Overview

This implementation plan transforms the basic PR Review Agent into a comprehensive development process management platform. The system will provide intelligent review automation, team analytics, quality control, security scanning, self-healing capabilities, and real-time monitoring.

The implementation is organized into 11 phases following the requirements structure, with each phase building upon previous work. Tasks include property-based testing sub-tasks to validate correctness properties from the design document.

**Technology Stack**: Node.js (ES modules), Electron, SQLite (better-sqlite3), GitHub CLI, Express.js, WebSocket (ws), fast-check for property-based testing

**Implementation Approach**: Incremental development with checkpoints, test-driven where applicable, and continuous validation through property tests.

## Tasks

### Phase 1: Foundation (Data Model, Configuration, Parsing, Export)

- [x] 1. Set up project structure and core dependencies
  - Create directory structure (src/, tests/, config/, data/)
  - Initialize package.json with dependencies (better-sqlite3, express, ws, fast-check, electron)
  - Set up ES modules configuration
  - Create .gitignore for node_modules, data/, logs/
  - _Requirements: 41.1, 41.2_

- [x] 2. Implement database schema and initialization
  - [x] 2.1 Create database schema SQL file with all 15+ tables
    - Define pull_requests, review_sessions, review_comments tables
    - Define developers, repositories, expertise_areas tables
    - Define metrics tables (pr_metrics, developer_metrics)
    - Define security_findings, auto_fix_attempts, test_runs tables
    - Define notifications, audit_trail, custom_rules tables
    - Add all indexes for query performance
    - _Requirements: 41.1, 41.2_
  
  - [x] 2.2 Create DatabaseManager class with initialization
    - Implement SQLite connection with WAL mode
    - Configure pragmas (journal_mode, synchronous, foreign_keys, cache_size)
    - Implement schema migration system
    - Add periodic checkpoint mechanism
    - _Requirements: 41.1, 53.1_
  
  - [x] 2.3 Write property test for database initialization
    - **Property 20: Query Performance with Indexes**
    - **Validates: Requirements 41.2**

- [x] 3. Implement configuration management system
  - [x] 3.1 Create ConfigurationManager class
    - Implement JSON/YAML config file parsing
    - Support repository-specific configuration
    - Implement config validation logic
    - Add default configuration values
    - _Requirements: 47.1, 47.2, 47.3_
  
  - [x] 3.2 Create repository_config table operations
    - Implement config storage and retrieval
    - Add config versioning support
    - Implement config update with audit trail
    - _Requirements: 47.1, 47.3_
  
  - [x] 3.3 Write property test for configuration round-trip
    - **Property 22: Configuration Round-Trip**
    - **Validates: Requirements 47.3**


- [x] 4. Implement review comment parsing system
  - [x] 4.1 Create CommentParser class
    - Implement structured comment format parser
    - Extract file path, line number, issue type, severity, message
    - Parse suggested fixes from AI executor output
    - Handle multiple comment formats (Gemini, Copilot, Kiro, Claude, Codex, OpenCode)
    - _Requirements: 45.1, 45.2_
  
  - [x] 4.2 Write property test for comment parsing completeness
    - **Property 21: Comment Parsing Completeness**
    - **Validates: Requirements 45.1**
  
  - [x] 4.3 Write unit tests for comment parser
    - Test parsing of valid structured comments
    - Test handling of malformed comments
    - Test extraction of all fields
    - _Requirements: 45.1_

- [x] 5. Implement data export system
  - [x] 5.1 Create DataExporter class
    - Implement CSV export for metrics data
    - Implement JSON export for review sessions
    - Support filtering by date range, repository, developer
    - Generate export files with unique IDs
    - _Requirements: 48.1, 48.2, 48.3_
  
  - [x] 5.2 Create export file management
    - Store export metadata in exports table
    - Implement cleanup of expired exports (7 days)
    - Add download endpoint for export files
    - _Requirements: 48.1, 48.2_
  
  - [x] 5.3 Write property test for export/import round-trip
    - **Property 23: Export/Import Round-Trip**
    - **Validates: Requirements 48.3**

- [x] 6. Checkpoint - Ensure foundation tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: Analytics & Metrics (Metrics Collection and Visualization)

- [x] 7. Implement Metrics Engine core
  - [x] 7.1 Create MetricsEngine class
    - Implement recordReview method to store review data
    - Calculate review duration and store in database
    - Track review outcomes (approved, rejected, needs_changes)
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 7.2 Write property test for review duration persistence
    - **Property 1: Review Duration Persistence**
    - **Validates: Requirements 1.1**
  
  - [x] 7.3 Write property test for time-to-merge calculation
    - **Property 6: Time-to-Merge Calculation**
    - **Validates: Requirements 5.2**

- [x] 8. Implement metrics calculation and aggregation
  - [x] 8.1 Add calculateMetrics method to MetricsEngine
    - Calculate average review time for time ranges
    - Calculate approval rates by executor
    - Aggregate metrics by repository and developer
    - Implement time-bucketing (hour/day/week/month)
    - _Requirements: 1.4, 2.1, 2.2_
  
  - [x] 8.2 Write property test for metrics calculation performance
    - **Property 2: Metrics Calculation Performance**
    - **Validates: Requirements 1.4**
  
  - [x] 8.3 Write property test for time range filtering
    - **Property 3: Time Range Filtering**
    - **Validates: Requirements 2.4**

- [x] 9. Implement trend analysis and anomaly detection
  - [x] 9.1 Add trend analysis to MetricsEngine
    - Implement exponential weighted moving average
    - Calculate trend direction and magnitude
    - Support multiple granularities (daily, weekly, monthly)
    - _Requirements: 2.3, 2.4_
  
  - [x] 9.2 Implement anomaly detection
    - Calculate Z-scores for metrics
    - Flag anomalies (> 2 standard deviations)
    - Track anomaly history
    - _Requirements: 2.3_
  
  - [x] 9.3 Write unit tests for trend analysis
    - Test moving average calculation
    - Test anomaly detection with known outliers
    - _Requirements: 2.3_


- [x] 10. Implement developer and repository metrics
  - [x] 10.1 Add getDeveloperMetrics method
    - Calculate per-developer review counts
    - Track average review time per developer
    - Calculate approval/rejection rates
    - _Requirements: 3.1, 3.2_
  
  - [x] 10.2 Add getRepositoryMetrics method
    - Calculate per-repository metrics
    - Track PR volume and velocity
    - Calculate repository-level quality scores
    - _Requirements: 3.3_
  
  - [x] 10.3 Write unit tests for developer metrics
    - Test metrics calculation with sample data
    - Test edge cases (no reviews, single review)
    - _Requirements: 3.1, 3.2_

- [x] 11. Implement rejection reason categorization
  - [x] 11.1 Create RejectionCategorizer class
    - Define issue type categories (security, quality, testing, documentation)
    - Implement categorization logic based on comment types
    - Track rejection reason frequencies
    - _Requirements: 4.1, 4.2_
  
  - [x] 11.2 Write property test for comment categorization
    - **Property 5: Comment Categorization Completeness**
    - **Validates: Requirements 4.1**

- [x] 12. Implement metrics visualization data preparation
  - [x] 12.1 Create visualization data formatters
    - Format data for time-series charts
    - Format data for bar charts (approval rates, rejection reasons)
    - Format data for pie charts (issue type distribution)
    - _Requirements: 5.1, 5.3_
  
  - [x] 12.2 Add metrics export for visualization
    - Export data in formats suitable for charting libraries
    - Support filtering and aggregation for charts
    - _Requirements: 5.1_

- [x] 13. Implement performance alerts
  - [x] 13.1 Create PerformanceAlertService
    - Monitor developer performance vs team average
    - Detect consecutive weeks below average
    - Generate alert notifications
    - _Requirements: 3.5_
  
  - [x] 13.2 Write property test for performance alert triggering
    - **Property 4: Performance Alert Triggering**
    - **Validates: Requirements 3.5**

- [x] 14. Checkpoint - Ensure analytics tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: Team Management (Assignment, Queue, Workload, Capacity)

- [x] 15. Implement Assignment Engine core
  - [x] 15.1 Create AssignmentEngine class
    - Implement expertise scoring based on file patterns
    - Calculate workload scores for reviewers
    - Check reviewer availability
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 15.2 Implement assignReviewers method
    - Select optimal reviewers using multi-criteria scoring
    - Assign between 1-3 reviewers per PR
    - Update reviewer workload after assignment
    - Call GitHub API to assign reviewers
    - _Requirements: 7.4, 7.5_
  
  - [x] 15.3 Write property test for reviewer assignment bounds
    - **Property 7: Reviewer Assignment Bounds**
    - **Validates: Requirements 7.5**

- [x] 16. Implement expertise tracking system
  - [x] 16.1 Create expertise_areas table operations
    - Track file patterns per developer
    - Calculate expertise scores using TF-IDF style algorithm
    - Update expertise based on PR activity
    - _Requirements: 7.1, 7.2_
  
  - [x] 16.2 Implement updateExpertise method
    - Extract file patterns from PR changes
    - Update or create expertise records
    - Decay old expertise over time
    - _Requirements: 7.2_
  
  - [x] 16.3 Write unit tests for expertise scoring
    - Test TF-IDF calculation
    - Test expertise decay
    - _Requirements: 7.1, 7.2_


- [x] 17. Implement workload management
  - [x] 17.1 Create workload calculation logic
    - Calculate workload based on pending reviews
    - Factor in authored PRs awaiting review
    - Implement weighted workload scoring
    - _Requirements: 7.3, 9.1_
  
  - [x] 17.2 Add getWorkload method
    - Query pending reviews for developer
    - Calculate current workload score
    - Update developer workload in database
    - _Requirements: 9.1_
  
  - [x] 17.3 Write unit tests for workload calculation
    - Test workload with various PR counts
    - Test workload updates
    - _Requirements: 9.1_

- [x] 18. Implement review queue and prioritization
  - [x] 18.1 Create ReviewQueue class
    - Implement priority score calculation
    - Factor in PR age, blocking status, SLA proximity
    - Sort queue by priority score
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 18.2 Implement priority score aging
    - Increase priority by 10 points per day
    - Update priority scores periodically
    - _Requirements: 8.3_
  
  - [x] 18.3 Write property test for priority score aging
    - **Property 8: Priority Score Aging**
    - **Validates: Requirements 8.3**

- [x] 19. Implement availability management
  - [x] 19.1 Add setAvailability method to AssignmentEngine
    - Mark developers as available/unavailable
    - Set unavailable_until timestamp
    - Exclude unavailable developers from assignment
    - _Requirements: 7.3_
  
  - [x] 19.2 Implement automatic availability restoration
    - Check unavailable_until timestamps periodically
    - Restore availability when time expires
    - _Requirements: 7.3_

- [x] 20. Implement capacity planning features
  - [x] 20.1 Create CapacityPlanner class
    - Calculate team capacity based on availability
    - Predict review completion times
    - Identify capacity bottlenecks
    - _Requirements: 11.1, 11.2_
  
  - [x] 20.2 Add capacity alerts
    - Alert when team capacity is exceeded
    - Suggest workload rebalancing
    - _Requirements: 11.2_

- [x] 21. Implement elapsed time tracking
  - [x] 21.1 Add elapsed time calculation
    - Calculate time since PR creation
    - Track time in each status
    - _Requirements: 10.1, 10.2_
  
  - [x] 21.2 Write property test for elapsed time accuracy
    - **Property 9: Elapsed Time Accuracy**
    - **Validates: Requirements 10.2**

- [x] 22. Checkpoint - Ensure team management tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: Quality Control (Quality Scoring, Rules, Checklists)

- [x] 23. Implement Quality Scorer
  - [x] 23.1 Create QualityScorer class
    - Implement quality score calculation formula
    - Calculate thoroughness score (issues found, coverage)
    - Calculate helpfulness score (constructive feedback, suggestions)
    - Calculate accuracy score (inverse of false positive rate)
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [x] 23.2 Implement scoreReview method
    - Analyze review comments for quality indicators
    - Calculate component scores
    - Compute weighted final score (0-100)
    - Store quality score in database
    - _Requirements: 12.1, 12.3_
  
  - [x] 23.3 Write property test for quality score bounds
    - **Property 10: Quality Score Bounds**
    - **Validates: Requirements 12.3**

- [x] 24. Implement false positive tracking
  - [x] 24.1 Add markFalsePositive method
    - Create false_positives table record
    - Link to review comment and developer
    - Store justification
    - _Requirements: 13.1, 13.2_
  
  - [x] 24.2 Implement false positive rate calculation
    - Calculate FP rate per executor
    - Calculate FP rate per issue category
    - Track FP trends over time
    - _Requirements: 13.3_
  
  - [x] 24.3 Write property test for false positive recording
    - **Property 11: False Positive Recording**
    - **Validates: Requirements 13.2**


- [x] 25. Implement Rule Engine
  - [x] 25.1 Create RuleEngine class
    - Load custom rules from repository configuration
    - Implement regex-based pattern matching
    - Implement AST-based structural checks (using acorn or babel parser)
    - Categorize violations by severity
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [x] 25.2 Implement executeRules method
    - Apply rules to PR diff
    - Filter rules by branch patterns
    - Collect and categorize violations
    - Generate violation reports
    - _Requirements: 14.2, 14.3_
  
  - [x] 25.3 Write property test for regex pattern matching
    - **Property 12: Regex Pattern Matching**
    - **Validates: Requirements 14.2**

- [x] 26. Implement rule management
  - [x] 26.1 Add rule CRUD operations
    - Implement saveRule method
    - Implement validateRule method
    - Implement testRule method (test against sample code)
    - Support rule enable/disable
    - _Requirements: 14.4, 14.5_
  
  - [x] 26.2 Create custom_rules table operations
    - Store rules in database
    - Support rule versioning
    - Track rule usage and effectiveness
    - _Requirements: 14.1, 14.4_
  
  - [x] 26.3 Write unit tests for rule validation
    - Test valid rule definitions
    - Test invalid regex patterns
    - Test AST rule validation
    - _Requirements: 14.4_

- [x] 27. Implement review checklists
  - [x] 27.1 Create ChecklistManager class
    - Define checklist templates
    - Track checklist completion per review
    - Generate checklist reports
    - _Requirements: 15.1, 15.2_
  
  - [x] 27.2 Integrate checklists with review process
    - Attach checklists to review sessions
    - Validate checklist completion
    - Include checklist status in quality score
    - _Requirements: 15.1, 15.2_

- [x] 28. Implement quality trends tracking
  - [x] 28.1 Add getQualityTrends method to QualityScorer
    - Track quality scores over time
    - Calculate quality trends per executor
    - Identify quality improvements or degradations
    - _Requirements: 12.4_
  
  - [x] 28.2 Write unit tests for quality trends
    - Test trend calculation with sample data
    - Test trend direction detection
    - _Requirements: 12.4_

- [x] 29. Checkpoint - Ensure quality control tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 5: Process Optimization (Batching, Templates, Auto-fixes)

- [x] 30. Implement batch review processing
  - [x] 30.1 Create BatchProcessor class
    - Identify related PRs (overlapping files, dependencies)
    - Group PRs for batch review
    - Process batches efficiently
    - _Requirements: 17.1, 17.2_
  
  - [x] 30.2 Write property test for related PR detection
    - **Property 13: Related PR Detection**
    - **Validates: Requirements 17.1**

- [x] 31. Implement orchestration sets
  - [x] 31.1 Create OrchestrationSet class
    - Define orchestration set structure
    - Track set progress and dependencies
    - Coordinate multi-PR workflows
    - _Requirements: 17.3_
  
  - [x] 31.2 Implement set-level operations
    - Assign reviewers to entire set
    - Track set completion
    - Generate set-level reports
    - _Requirements: 17.3_

- [x] 32. Implement review templates
  - [x] 32.1 Create TemplateManager class
    - Define review comment templates
    - Support template variables and placeholders
    - Categorize templates by issue type
    - _Requirements: 18.1, 18.2_
  
  - [x] 32.2 Integrate templates with review process
    - Apply templates to common issues
    - Allow template customization
    - Track template usage
    - _Requirements: 18.1, 18.2_


- [x] 33. Implement Auto-Fix Service
  - [x] 33.1 Create AutoFixService class
    - Implement isFixable method to check if issues are auto-fixable
    - Implement generateFixes method for different issue types
    - Support formatting fixes (prettier, eslint --fix)
    - Support import fixes (organize, remove unused)
    - Support simple refactoring fixes
    - _Requirements: 19.1, 19.2, 19.3_
  
  - [x] 33.2 Implement applyFixes method
    - Clone PR branch locally
    - Apply generated fixes to files
    - Create commit with fixes
    - Push commit to PR branch
    - _Requirements: 19.4, 19.5_
  
  - [x] 33.3 Implement fix verification
    - Run tests after applying fixes
    - Rollback if tests fail
    - Track fix success rates
    - _Requirements: 19.6_
  
  - [x] 33.4 Write property test for auto-fix application
    - **Property 14: Auto-Fix Application**
    - **Validates: Requirements 19.5**
  
  - [x] 33.5 Write property test for auto-fix verification
    - **Property 24: Auto-Fix Verification**
    - **Validates: Requirements 49.4**

- [x] 34. Implement auto-fix iteration logic
  - [x] 34.1 Add fixPR method with iteration support
    - Attempt fixes up to 3 times
    - Request re-review after successful fix
    - Handle fix failures gracefully
    - _Requirements: 19.6, 49.1, 49.2_
  
  - [x] 34.2 Track auto-fix attempts in database
    - Store fix attempts in auto_fix_attempts table
    - Track issues targeted and fixes applied
    - Record success/failure status
    - _Requirements: 19.6_

- [x] 35. Implement AI-powered fix generation
  - [x] 35.1 Create AIFixGenerator class
    - Integrate with AI executors for complex fixes
    - Generate fixes for non-trivial issues
    - Validate generated fixes
    - _Requirements: 19.3_
  
  - [x] 35.2 Write unit tests for fix generation
    - Test formatting fix generation
    - Test import fix generation
    - Test AI fix generation
    - _Requirements: 19.3_

- [x] 36. Checkpoint - Ensure process optimization tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 6: Communication (Notifications, Escalation, Discussions)

- [x] 37. Implement Notification Service core
  - [x] 37.1 Create NotificationService class
    - Implement sendNotification method
    - Support multiple notification types (PR events, review events, alerts)
    - Store notifications in database
    - _Requirements: 22.1, 22.2_
  
  - [x] 37.2 Implement notification preferences
    - Load user notification preferences
    - Check quiet hours before sending
    - Respect notification type preferences
    - _Requirements: 22.3_
  
  - [x] 37.3 Implement shouldNotify method
    - Check if notification should be sent based on preferences
    - Check quiet hours
    - Check notification frequency limits
    - _Requirements: 22.3_

- [x] 38. Implement email notification delivery
  - [x] 38.1 Create EmailDeliveryService
    - Configure SMTP connection
    - Format notification emails
    - Send emails asynchronously
    - Track delivery status
    - _Requirements: 22.1, 22.2_
  
  - [x] 38.2 Implement email templates
    - Create templates for each notification type
    - Support HTML and plain text formats
    - Include relevant PR/review links
    - _Requirements: 22.1_

- [x] 39. Implement notification batching
  - [x] 39.1 Add sendBatch method
    - Group related notifications
    - Send as single email/message
    - Track batch IDs
    - _Requirements: 22.4_
  
  - [x] 39.2 Implement daily digest
    - Generate daily summary of activity
    - Include key metrics and pending items
    - Send at configured time
    - _Requirements: 22.4_
  
  - [x] 39.3 Write unit tests for notification batching
    - Test batch grouping logic
    - Test digest generation
    - _Requirements: 22.4_


- [x] 40. Implement escalation system
  - [x] 40.1 Create EscalationService
    - Define escalation triggers (SLA exceeded, stuck PRs, critical issues)
    - Implement escalation levels (team lead, manager, director)
    - Track escalation history
    - _Requirements: 23.1, 23.2_
  
  - [x] 40.2 Implement escalate method
    - Determine escalation level based on severity
    - Notify appropriate stakeholders
    - Create escalation audit trail
    - _Requirements: 23.1, 23.2_
  
  - [x] 40.3 Write unit tests for escalation logic
    - Test escalation triggers
    - Test escalation level determination
    - _Requirements: 23.1_

- [x] 41. Implement discussion thread tracking
  - [x] 41.1 Create DiscussionTracker class
    - Track comment threads on PRs
    - Monitor thread resolution status
    - Identify unresolved discussions
    - _Requirements: 24.1_
  
  - [x] 41.2 Integrate with GitHub discussions
    - Fetch discussion threads via GitHub API
    - Track thread participants
    - Monitor thread activity
    - _Requirements: 24.1_

- [x] 42. Implement SLA monitoring
  - [x] 42.1 Create SLAMonitor class
    - Calculate time remaining until SLA breach
    - Send warnings at 75% and 90% of SLA time
    - Track SLA compliance rates
    - _Requirements: 23.3_
  
  - [x] 42.2 Add SLA alerts
    - Alert reviewers when SLA is approaching
    - Escalate when SLA is exceeded
    - Generate SLA compliance reports
    - _Requirements: 23.3_

- [x] 43. Checkpoint - Ensure communication tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 7: Security & Compliance (Vulnerability, License, Audit)

- [x] 44. Implement Security Scanner core
  - [x] 44.1 Create SecurityScanner class
    - Define vulnerability patterns (SQL injection, XSS, CSRF)
    - Implement pattern matching for vulnerabilities
    - Categorize findings by severity
    - _Requirements: 26.1, 26.2_
  
  - [x] 44.2 Implement scanPR method
    - Scan PR diff for vulnerability patterns
    - Check dependencies for CVEs
    - Validate licenses
    - Detect sensitive data
    - Store findings in security_findings table
    - _Requirements: 26.1, 26.2, 27.1, 28.1_
  
  - [x] 44.3 Write property test for vulnerability detection
    - **Property 15: Vulnerability Pattern Detection**
    - **Validates: Requirements 26.1**
  
  - [x] 44.4 Write property test for sensitive data detection
    - **Property 16: Sensitive Data Detection**
    - **Validates: Requirements 28.1**

- [x] 45. Implement dependency security scanning
  - [x] 45.1 Create DependencyScanner class
    - Parse package.json, package-lock.json, yarn.lock
    - Query GitHub Security Advisories API
    - Check npm audit results
    - _Requirements: 26.3_
  
  - [x] 45.2 Implement checkDependencies method
    - Extract dependencies from PR changes
    - Query CVE databases
    - Generate security findings for vulnerable dependencies
    - _Requirements: 26.3_
  
  - [x] 45.3 Write unit tests for dependency scanning
    - Test dependency extraction
    - Test CVE detection with known vulnerabilities
    - _Requirements: 26.3_

- [x] 46. Implement license compliance scanning
  - [x] 46.1 Create LicenseScanner class
    - Extract licenses from package.json
    - Check against allowlist and blocklist
    - Detect license conflicts
    - _Requirements: 27.1, 27.2_
  
  - [x] 46.2 Implement validateLicenses method
    - Compare licenses against configured lists
    - Generate findings for blocked licenses
    - Warn about missing licenses
    - _Requirements: 27.1, 27.2_
  
  - [x] 46.3 Write unit tests for license validation
    - Test allowlist/blocklist checking
    - Test license conflict detection
    - _Requirements: 27.1, 27.2_


- [x] 47. Implement sensitive data detection
  - [x] 47.1 Create SensitiveDataHandler class
    - Define patterns for API keys, passwords, tokens
    - Define patterns for PII (emails, phones, SSNs, credit cards)
    - Implement high-entropy string detection
    - _Requirements: 28.1, 28.2_
  
  - [x] 47.2 Implement detectSensitiveData method
    - Scan diff for sensitive patterns
    - Calculate entropy for potential secrets
    - Generate findings with severity
    - _Requirements: 28.1_
  
  - [x] 47.3 Implement data redaction
    - Redact sensitive data from logs and displays
    - Preserve context while hiding sensitive values
    - _Requirements: 28.2_
  
  - [x] 47.4 Write unit tests for sensitive data detection
    - Test API key pattern detection
    - Test PII pattern detection
    - Test entropy-based secret detection
    - _Requirements: 28.1_

- [x] 48. Implement security reporting
  - [x] 48.1 Add generateReport method to SecurityScanner
    - Aggregate security findings
    - Categorize by severity and type
    - Include remediation guidance
    - _Requirements: 26.4_
  
  - [x] 48.2 Create security report templates
    - Format findings for readability
    - Include code snippets and locations
    - Provide actionable recommendations
    - _Requirements: 26.4_

- [x] 49. Implement audit trail system
  - [x] 49.1 Create AuditLogger class
    - Log all automated actions
    - Log configuration changes
    - Log security events
    - Store in audit_trail table
    - _Requirements: 29.1, 29.2_
  
  - [x] 49.2 Implement audit trail query methods
    - Query by time range, action type, actor
    - Support filtering and pagination
    - Generate audit reports
    - _Requirements: 29.3_
  
  - [x] 49.3 Write property test for audit trail immutability
    - **Property 17: Audit Trail Immutability**
    - **Validates: Requirements 29.1**

- [x] 50. Implement compliance reporting
  - [x] 50.1 Create ComplianceReporter class
    - Generate compliance reports for security findings
    - Track compliance metrics over time
    - Support multiple compliance frameworks
    - _Requirements: 30.1_
  
  - [x] 50.2 Add compliance report export
    - Export reports in PDF/CSV formats
    - Include executive summaries
    - _Requirements: 30.1_

- [x] 51. Checkpoint - Ensure security & compliance tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 8: Developer Experience (Dashboards, Gamification)

- [x] 52. Implement PR health score calculation
  - [x] 52.1 Create HealthScoreCalculator class
    - Calculate test coverage score
    - Calculate code complexity score
    - Calculate review findings score
    - Calculate documentation score
    - Compute weighted health score (0-100)
    - _Requirements: 31.1, 31.2_
  
  - [x] 52.2 Write property test for health score bounds and consistency
    - **Property 18: Health Score Bounds and Consistency**
    - **Validates: Requirements 31.1**

- [x] 53. Implement personal developer dashboard
  - [x] 53.1 Create DeveloperDashboard class
    - Show assigned PRs and reviews
    - Display personal metrics (review count, avg time)
    - Show pending actions
    - _Requirements: 32.1, 32.2_
  
  - [x] 53.2 Add dashboard data API endpoints
    - GET /api/dashboard/developer/:id
    - Include workload, metrics, pending items
    - _Requirements: 32.1_

- [x] 54. Implement feedback analytics
  - [x] 54.1 Create FeedbackAnalyzer class
    - Analyze review comment sentiment
    - Track feedback patterns per developer
    - Identify improvement areas
    - _Requirements: 33.1_
  
  - [x] 54.2 Generate feedback reports
    - Provide constructive feedback summaries
    - Highlight strengths and areas for growth
    - _Requirements: 33.1_


- [x] 55. Implement gamification system
  - [x] 55.1 Create GamificationEngine class
    - Define point system for activities (reviews, PRs, quality)
    - Track points per developer
    - Implement achievement badges
    - _Requirements: 34.1, 34.2_
  
  - [x] 55.2 Add leaderboard functionality
    - Calculate rankings based on points
    - Support multiple leaderboard categories
    - Update leaderboards in real-time
    - _Requirements: 34.3_
  
  - [x] 55.3 Implement achievement system
    - Define achievement criteria
    - Track achievement progress
    - Award badges when criteria met
    - _Requirements: 34.2_
  
  - [x] 55.4 Write unit tests for gamification
    - Test point calculation
    - Test achievement unlocking
    - Test leaderboard ranking
    - _Requirements: 34.1, 34.2_

- [x] 56. Implement smart notifications
  - [x] 56.1 Create SmartNotificationEngine
    - Prioritize notifications by importance
    - Reduce notification noise
    - Group related notifications
    - _Requirements: 35.1_
  
  - [x] 56.2 Implement notification intelligence
    - Learn from user interactions
    - Adjust notification timing
    - Personalize notification content
    - _Requirements: 35.1_

- [x] 57. Checkpoint - Ensure developer experience tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 9: Technical Integration (Multi-repo, CI/CD, Coverage)

- [x] 58. Implement GitHub API integration
  - [x] 58.1 Create GitHubClient class
    - Wrap GitHub CLI (gh) commands
    - Implement getPR, getPRDiff methods
    - Implement addReviewComment, requestChanges, approvePR methods
    - Implement assignReviewers, mergePR methods
    - _Requirements: 36.1, 36.2_
  
  - [x] 58.2 Add error handling and retry logic
    - Handle rate limits
    - Retry on transient failures
    - Log API calls for debugging
    - _Requirements: 36.2_
  
  - [x] 58.3 Write unit tests for GitHub client
    - Mock gh CLI calls
    - Test error handling
    - Test retry logic
    - _Requirements: 36.1_

- [x] 59. Implement multi-repository support
  - [x] 59.1 Add repository management
    - Store multiple repositories in database
    - Support per-repository configuration
    - Handle cross-repository dependencies
    - _Requirements: 36.3_
  
  - [x] 59.2 Implement repository switching
    - Switch context between repositories
    - Load repository-specific rules and config
    - _Requirements: 36.3_

- [x] 60. Implement AI executor integration
  - [x] 60.1 Create AIExecutor base class
    - Define common interface for all executors
    - Implement buildReviewPrompt method
    - Implement parseReviewOutput method
    - _Requirements: 37.1, 37.2_
  
  - [x] 60.2 Implement executor-specific subclasses
    - GeminiExecutor, CopilotExecutor, KiroExecutor
    - ClaudeExecutor, CodexExecutor, OpenCodeExecutor
    - Handle executor-specific output formats
    - _Requirements: 37.1, 37.2_
  
  - [x] 60.3 Add executor selection logic
    - Select executor based on priority and availability
    - Fallback to alternative executors on failure
    - _Requirements: 37.3_
  
  - [x] 60.4 Write unit tests for AI executors
    - Test prompt generation
    - Test output parsing
    - Test executor selection
    - _Requirements: 37.1, 37.2_

- [x] 61. Implement CI/CD integration
  - [x] 61.1 Create CIIntegration class
    - Fetch test results from GitHub checks
    - Parse coverage reports (lcov, cobertura, jacoco)
    - Extract performance benchmarks
    - _Requirements: 38.1, 38.2_
  
  - [x] 61.2 Implement getTestResults method
    - Query GitHub API for check runs
    - Aggregate test status
    - Count passed/failed tests
    - _Requirements: 38.1_
  
  - [x] 61.3 Write unit tests for CI integration
    - Test check run parsing
    - Test coverage report parsing
    - _Requirements: 38.1, 38.2_


- [x] 62. Implement coverage tracking
  - [x] 62.1 Create CoverageTracker class
    - Parse coverage reports from CI artifacts
    - Calculate coverage percentages
    - Track coverage per file and overall
    - _Requirements: 39.1, 39.2_
  
  - [x] 62.2 Implement coverage delta calculation
    - Compare PR coverage to base branch
    - Calculate coverage change
    - Flag coverage decreases
    - _Requirements: 39.2_
  
  - [x] 62.3 Write property test for coverage delta calculation
    - **Property 19: Coverage Delta Calculation**
    - **Validates: Requirements 39.2**

- [x] 63. Implement webhook handler
  - [x] 63.1 Create WebhookHandler class
    - Verify webhook signatures
    - Parse webhook payloads
    - Route events to appropriate handlers
    - _Requirements: 40.1, 40.2_
  
  - [x] 63.2 Implement event handlers
    - Handle pull_request.opened, pull_request.synchronize
    - Handle pull_request_review.submitted
    - Handle check_suite.completed
    - _Requirements: 40.1, 40.2_
  
  - [x] 63.3 Add webhook endpoint
    - POST /api/webhooks/github
    - Validate signatures
    - Process events asynchronously
    - _Requirements: 40.1_
  
  - [x] 63.4 Write unit tests for webhook handling
    - Test signature verification
    - Test payload parsing
    - Test event routing
    - _Requirements: 40.1_

- [x] 64. Checkpoint - Ensure technical integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 10: Review Engine & Core Workflow

- [x] 65. Implement Review Engine core
  - [x] 65.1 Create ReviewEngine class
    - Implement reviewPR method to orchestrate review workflow
    - Coordinate Test & Heal → Rule Validation → AI Review → Quality Scoring
    - Track review session status
    - _Requirements: 1.1, 1.2, 45.1_
  
  - [x] 65.2 Implement review session management
    - Create review_sessions table records
    - Update session status (pending, processing, completed, failed)
    - Store review outcomes and rejection reasons
    - _Requirements: 1.1, 1.2_
  
  - [x] 65.3 Implement getReviewStatus method
    - Query review session by ID
    - Return current status and progress
    - _Requirements: 1.3_

- [x] 66. Implement review workflow orchestration
  - [x] 66.1 Add workflow steps to reviewPR
    - Step 1: Run Test & Heal
    - Step 2: Execute custom rules
    - Step 3: Run AI review
    - Step 4: Calculate quality score
    - Step 5: Determine outcome (approved/rejected/needs_changes)
    - _Requirements: 1.1, 12.1, 14.2, 49.1_
  
  - [x] 66.2 Implement review level determination
    - Match branch patterns to review levels (strict/standard/relaxed)
    - Apply appropriate rules and checks
    - _Requirements: 14.3_
  
  - [x] 66.3 Write integration tests for review workflow
    - Test complete review flow
    - Test workflow with different review levels
    - _Requirements: 1.1_

- [x] 67. Implement review comment management
  - [x] 67.1 Add comment storage and retrieval
    - Store parsed comments in review_comments table
    - Link comments to review sessions
    - Track comment resolution status
    - _Requirements: 45.1, 45.2_
  
  - [x] 67.2 Implement getReviewHistory method
    - Query all review sessions for a PR
    - Include comments and outcomes
    - Show review progression over time
    - _Requirements: 1.3_

- [x] 68. Implement re-review functionality
  - [x] 68.1 Add reReview method
    - Trigger review after auto-fix or manual changes
    - Link to previous review session
    - Compare outcomes
    - _Requirements: 19.6, 49.2_
  
  - [x] 68.2 Track review iterations
    - Count review attempts
    - Track changes between reviews
    - _Requirements: 19.6_

- [x] 69. Implement review cancellation
  - [x] 69.1 Add cancelReview method
    - Stop ongoing review session
    - Update status to cancelled
    - Clean up resources
    - _Requirements: 1.3_

- [x] 70. Checkpoint - Ensure review engine tests pass
  - Ensure all tests pass, ask the user if questions arise.


### Phase 11: Reliability & Self-Healing (Auto-fix, Test & Heal, Monitoring)

- [x] 71. Implement Test & Heal Service
  - [x] 71.1 Create TestAndHealService class
    - Implement runTests method to execute test suites
    - Parse test results and identify failures
    - Categorize failures (import_error, snapshot_mismatch, timeout, type_error, formatting)
    - _Requirements: 50.1, 50.2_
  
  - [x] 71.2 Implement TestFailureAnalyzer
    - Analyze failure messages and stack traces
    - Determine if failures are healable
    - Generate healing fixes for common issues
    - _Requirements: 50.2, 50.3_
  
  - [x] 71.3 Implement healFailures method
    - Apply healing fixes (fix imports, update snapshots, increase timeouts)
    - Re-run tests after healing
    - Track healing attempts and success rates
    - _Requirements: 50.3, 50.4_
  
  - [x] 71.4 Write unit tests for test & heal
    - Test failure categorization
    - Test healing fix generation
    - Test re-run logic
    - _Requirements: 50.2, 50.3_

- [x] 72. Implement Health Service
  - [x] 72.1 Create HealthService class
    - Implement getHealthStatus method
    - Check database connectivity
    - Check disk space availability
    - Check memory usage
    - Check GitHub API rate limits
    - Check AI executor availability
    - _Requirements: 51.1, 51.2_
  
  - [x] 72.2 Implement health monitoring
    - Run health checks periodically (every 5 minutes)
    - Log health check results
    - Alert on critical issues
    - _Requirements: 51.1, 51.2_
  
  - [x] 72.3 Write property test for health check completeness
    - **Property 25: Health Check Completeness**
    - **Validates: Requirements 51.2**

- [x] 73. Implement stuck task detection and recovery
  - [x] 73.1 Create StuckTaskDetector class
    - Detect tasks in "processing" status for > 1 hour
    - Determine stuck reason (no lock owner, repeated failures, timeout)
    - _Requirements: 52.1, 52.2_
  
  - [x] 73.2 Implement recoverTask method
    - Retry task if retry_count < 3
    - Mark as failed if max retries exceeded
    - Notify administrators of stuck tasks
    - _Requirements: 52.2, 52.3_
  
  - [x] 73.3 Write property test for stuck task detection
    - **Property 26: Stuck Task Detection**
    - **Validates: Requirements 52.1**

- [x] 74. Implement transaction management
  - [x] 74.1 Create DatabaseTransaction class
    - Wrap operations in SQLite transactions
    - Implement automatic rollback on errors
    - Validate database integrity after transactions
    - _Requirements: 53.1, 53.2_
  
  - [x] 74.2 Write property test for transaction atomicity
    - **Property 27: Transaction Atomicity**
    - **Validates: Requirements 53.1**

- [x] 75. Implement graceful shutdown
  - [x] 75.1 Create GracefulShutdown class
    - Handle SIGTERM and SIGINT signals
    - Stop accepting new requests
    - Wait for active requests to complete (timeout: 30s)
    - Wait for active tasks to complete (timeout: 4 minutes)
    - Mark interrupted tasks in database
    - _Requirements: 54.1, 54.2, 54.3_
  
  - [x] 75.2 Implement shutdown steps
    - Save in-memory state to database
    - Close WebSocket connections
    - Close database connections with final checkpoint
    - Cleanup orphaned resources
    - _Requirements: 54.1, 54.3_
  
  - [x] 75.3 Write property test for shutdown task rejection
    - **Property 28: Shutdown Task Rejection**
    - **Validates: Requirements 54.2**

- [x] 76. Implement task locking for concurrency
  - [x] 76.1 Create TaskLockManager class
    - Implement acquireLock method with optimistic locking
    - Use lock_timestamp and lock_owner fields
    - Set lock timeout (1 hour)
    - _Requirements: 55.1, 55.2_
  
  - [x] 76.2 Implement lock verification
    - Verify lock before task updates
    - Handle lock expiration
    - Detect lock theft
    - _Requirements: 55.2, 55.3_
  
  - [x] 76.3 Write property test for task lock atomicity
    - **Property 29: Task Lock Atomicity**
    - **Validates: Requirements 55.2**


- [x] 77. Implement retry mechanism with exponential backoff
  - [x] 77.1 Create RetryStrategy class
    - Implement execute method with retry logic
    - Calculate exponential backoff delays (1s, 2s, 4s, 8s, 16s)
    - Add jitter to prevent thundering herd
    - Check if errors are retryable
    - _Requirements: 56.1, 56.2, 56.3_
  
  - [x] 77.2 Implement retry logging
    - Log retry attempts with context
    - Log retry success/failure
    - Track retry metrics
    - _Requirements: 56.3_
  
  - [x] 77.3 Write property test for exponential backoff sequence
    - **Property 30: Exponential Backoff Sequence**
    - **Validates: Requirements 56.2**

- [x] 78. Implement WebSocket connection management
  - [x] 78.1 Create WebSocket server
    - Set up ws library server
    - Handle client connections
    - Implement authentication
    - Track active connections
    - _Requirements: 57.1, 57.2_
  
  - [x] 78.2 Implement connection health monitoring
    - Send ping messages periodically
    - Detect disconnections
    - Clean up stale connections
    - _Requirements: 57.3, 57.4_
  
  - [x] 78.3 Implement auto-reconnect on client side
    - Detect disconnection events
    - Attempt reconnection with exponential backoff
    - Restore subscriptions after reconnect
    - _Requirements: 57.5_
  
  - [x] 78.4 Write property test for WebSocket auto-reconnect
    - **Property 31: WebSocket Auto-Reconnect**
    - **Validates: Requirements 57.5**

- [x] 79. Implement memory leak prevention
  - [x] 79.1 Create ResourceManager class
    - Track event listeners and remove when done
    - Track file handles and close properly
    - Track streams and destroy when done
    - Track timers and clear when done
    - _Requirements: 58.1, 58.2_
  
  - [x] 79.2 Implement memory monitoring
    - Monitor heap usage periodically
    - Trigger garbage collection at high usage (>80%)
    - Log memory usage trends
    - _Requirements: 58.2_
  
  - [x] 79.3 Write property test for event listener cleanup
    - **Property 32: Event Listener Cleanup**
    - **Validates: Requirements 58.1**

- [x] 80. Implement resource cleanup
  - [x] 80.1 Create ResourceCleanup class
    - Cleanup temporary files older than 24 hours
    - Cleanup cloned repositories not in use
    - Cleanup expired exports (7 days)
    - Cleanup old WebSocket connections
    - _Requirements: 58.3_
  
  - [x] 80.2 Schedule periodic cleanup
    - Run cleanup every hour
    - Log cleanup operations
    - _Requirements: 58.3_

- [x] 81. Checkpoint - Ensure reliability tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 12: REST API & WebSocket Communication

- [x] 82. Implement REST API server
  - [x] 82.1 Create Express.js server
    - Set up Express app with middleware
    - Configure CORS, body parsing, compression
    - Add request logging
    - Add error handling middleware
    - _Requirements: 43.1_
  
  - [x] 82.2 Implement authentication middleware
    - Create AuthenticationManager
    - Support API key authentication
    - Support session token authentication
    - Log authentication attempts
    - _Requirements: 43.2_
  
  - [x] 82.3 Implement authorization middleware
    - Check user permissions for endpoints
    - Log unauthorized access attempts
    - _Requirements: 43.2_

- [x] 83. Implement PR endpoints
  - [x] 83.1 Create PR route handlers
    - GET /api/prs - List PRs with filters
    - GET /api/prs/:id - Get PR details
    - POST /api/prs/:id/review - Trigger review
    - GET /api/prs/:id/status - Get review status
    - POST /api/prs/:id/auto-fix - Trigger auto-fix
    - GET /api/prs/:id/health - Get health score
    - GET /api/prs/:id/history - Get review history
    - _Requirements: 43.1_

- [x] 84. Implement review endpoints
  - [x] 84.1 Create review route handlers
    - GET /api/reviews/:id - Get review details
    - POST /api/reviews/:id/cancel - Cancel review
    - GET /api/reviews/:id/comments - Get review comments
    - POST /api/comments/:id/false-positive - Mark as false positive
    - _Requirements: 43.1_

- [x] 85. Implement metrics endpoints
  - [x] 85.1 Create metrics route handlers
    - GET /api/metrics/overview - Get dashboard overview
    - GET /api/metrics/repository/:id - Get repository metrics
    - GET /api/metrics/developer/:id - Get developer metrics
    - GET /api/metrics/trends - Get trend analysis
    - POST /api/metrics/export - Export metrics data
    - _Requirements: 43.1, 48.1_


- [x] 86. Implement assignment and security endpoints
  - [x] 86.1 Create assignment route handlers
    - POST /api/assignments/assign - Assign reviewers
    - GET /api/assignments/workload - Get team workload
    - PUT /api/developers/:id/availability - Update availability
    - _Requirements: 43.1_
  
  - [x] 86.2 Create security route handlers
    - GET /api/security/findings/:prId - Get security findings
    - GET /api/security/report/:prId - Generate security report
    - POST /api/security/scan/:prId - Trigger security scan
    - _Requirements: 43.1_

- [x] 87. Implement configuration and health endpoints
  - [x] 87.1 Create configuration route handlers
    - GET /api/config/:repoId - Get repository config
    - PUT /api/config/:repoId - Update repository config
    - POST /api/config/validate - Validate config
    - GET /api/rules/:repoId - Get custom rules
    - POST /api/rules/:repoId - Create/update rule
    - DELETE /api/rules/:ruleId - Delete rule
    - _Requirements: 43.1, 47.1_
  
  - [x] 87.2 Create health and audit route handlers
    - GET /api/health - Basic health check
    - GET /api/health/detailed - Detailed health metrics
    - GET /api/tasks/stuck - Get stuck tasks
    - POST /api/tasks/:id/recover - Trigger task recovery
    - GET /api/audit - Query audit trail
    - POST /api/compliance/report - Generate compliance report
    - GET /api/export/:exportId - Download export file
    - _Requirements: 43.1, 51.1, 29.3_

- [x] 88. Implement WebSocket event broadcasting
  - [x] 88.1 Create WebSocket event handlers
    - Handle subscribe/unsubscribe messages
    - Handle authentication messages
    - Handle ping/pong for keepalive
    - _Requirements: 44.1, 44.2_
  
  - [x] 88.2 Implement broadcast methods
    - Broadcast PR updates (pr_update)
    - Broadcast review progress (review_progress)
    - Broadcast real-time logs (log)
    - Broadcast metrics updates (metrics_update)
    - Broadcast health alerts (health_alert)
    - _Requirements: 44.1, 44.2_
  
  - [x] 88.3 Write integration tests for WebSocket
    - Test subscription management
    - Test event broadcasting
    - Test authentication
    - _Requirements: 44.1_

- [x] 89. Checkpoint - Ensure API tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 13: Dashboard UI (Electron App)

- [x] 90. Set up Electron application
  - [x] 90.1 Create Electron main process
    - Initialize Electron app
    - Create main window
    - Set up IPC communication
    - Configure window settings
    - _Requirements: 46.1_
  
  - [x] 90.2 Create renderer process structure
    - Set up HTML/CSS/JS structure
    - Configure build system (webpack/vite)
    - Set up hot reload for development
    - _Requirements: 46.1_

- [x] 91. Implement dashboard overview tab
  - [x] 91.1 Create overview UI components
    - Key metrics cards (Open PRs, Avg Time, SLA, Quality)
    - Review queue list with priority indicators
    - Team workload bar chart
    - Recent activity feed
    - _Requirements: 46.2, 46.3_
  
  - [x] 91.2 Connect overview to WebSocket
    - Subscribe to dashboard channel
    - Update metrics in real-time
    - Update activity feed with live events
    - _Requirements: 46.3_

- [x] 92. Implement PRs tab
  - [x] 92.1 Create PR list UI
    - Display PR cards with status and health score
    - Add filters (status, repository, author)
    - Add search functionality
    - _Requirements: 46.2_
  
  - [x] 92.2 Implement PR detail view
    - Show PR information and review history
    - Display review comments
    - Add action buttons (View, Auto-fix)
    - _Requirements: 46.2_

- [x] 93. Implement metrics tab
  - [x] 93.1 Create metrics visualization
    - Review time trends line chart
    - Approval rate by executor bar chart
    - Top rejection reasons horizontal bar chart
    - _Requirements: 46.2, 5.1_
  
  - [x] 93.2 Add time range selector and export
    - Time range dropdown (Last 7/30/90 days)
    - Export CSV button
    - _Requirements: 5.1, 48.1_


- [x] 94. Implement team and security tabs
  - [x] 94.1 Create team management UI
    - Display team workload visualization
    - Show developer availability status
    - Add availability management controls
    - _Requirements: 46.2_
  
  - [x] 94.2 Create security dashboard
    - Display security findings by severity
    - Show vulnerability trends
    - List recent security alerts
    - _Requirements: 46.2_

- [x] 95. Implement configuration tab
  - [x] 95.1 Create configuration editor UI
    - Display current repository configuration
    - Add form for editing configuration
    - Validate configuration before saving
    - _Requirements: 46.2, 47.2_
  
  - [x] 95.2 Create custom rules editor
    - List existing rules
    - Add/edit/delete rule forms
    - Test rule against sample code
    - _Requirements: 46.2, 14.4_

- [x] 96. Implement real-time updates in UI
  - [x] 96.1 Create WebSocket client for dashboard
    - Connect to WebSocket server
    - Handle connection/disconnection
    - Implement auto-reconnect
    - _Requirements: 46.3, 57.5_
  
  - [x] 96.2 Update UI components on events
    - Update metrics on metrics_update events
    - Update PR list on pr_update events
    - Add logs to activity feed on log events
    - Show alerts on health_alert events
    - _Requirements: 46.3_

- [x] 97. Checkpoint - Ensure dashboard UI works
  - Ensure all tests pass, ask the user if questions arise.

### Phase 14: Integration & End-to-End Testing

- [x] 98. Implement end-to-end workflow integration
  - [x] 98.1 Wire webhook handler to review engine
    - Connect PR events to Test & Heal
    - Connect Test & Heal to Assignment Engine
    - Connect Assignment Engine to Review Engine
    - Connect Review Engine to Auto-Fix Service
    - _Requirements: 40.2, 49.1, 50.1_
  
  - [x] 98.2 Implement complete PR lifecycle
    - PR created → Test & Heal → Assign → Review → Auto-fix (if needed) → Re-review → Merge
    - Track state transitions
    - Broadcast updates via WebSocket
    - _Requirements: 1.1, 49.1, 50.1_
  
  - [x] 98.3 Write integration tests for complete workflow
    - Test PR creation to merge flow
    - Test auto-fix iteration flow
    - Test escalation flow
    - _Requirements: 1.1, 49.1_

- [x] 99. Implement auto-merge functionality
  - [x] 99.1 Create AutoMergeService
    - Check if PR meets auto-merge criteria
    - Verify health score threshold (>= 60)
    - Verify all checks passed
    - Trigger merge via GitHub API
    - _Requirements: 21.1, 21.2_
  
  - [x] 99.2 Add auto-merge configuration
    - Enable/disable per repository
    - Configure health score threshold
    - Configure required checks
    - _Requirements: 21.1_
  
  - [x] 99.3 Write unit tests for auto-merge
    - Test criteria checking
    - Test merge triggering
    - _Requirements: 21.1_

- [ ] 100. Implement error handling and logging
  - [ ] 100.1 Create global error handler
    - Handle operational errors (AppError)
    - Handle unexpected errors
    - Log errors to database
    - Return appropriate error responses
    - _Requirements: 53.2_
  
  - [ ] 100.2 Create error logging system
    - Log errors with context (request, user, timestamp)
    - Store in error_log table
    - Alert on critical errors
    - _Requirements: 53.2_

- [ ] 101. Implement comprehensive logging
  - [ ] 101.1 Create Logger class
    - Support multiple log levels (debug, info, warn, error)
    - Log to console and file
    - Rotate log files
    - _Requirements: 51.3_
  
  - [ ] 101.2 Add structured logging
    - Include context in log messages
    - Support log filtering and searching
    - _Requirements: 51.3_

- [ ] 102. Performance optimization
  - [ ] 102.1 Optimize database queries
    - Add missing indexes
    - Use prepared statements
    - Implement query result caching
    - _Requirements: 41.2_
  
  - [ ] 102.2 Optimize API response times
    - Implement response caching
    - Use pagination for large result sets
    - Optimize JSON serialization
    - _Requirements: 1.4_

- [ ] 103. Final checkpoint - Complete system test
  - Run all tests (unit, integration, property-based)
  - Test complete workflows end-to-end
  - Verify all requirements are met
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation at phase boundaries
- The implementation follows a bottom-up approach: foundation → services → engines → API → UI
- All database operations should use transactions where appropriate
- All external API calls should include retry logic with exponential backoff
- All WebSocket communications should handle reconnection gracefully
- Memory management and resource cleanup should be implemented throughout
- Security scanning and audit logging should be integrated into all critical operations

## Implementation Strategy

1. Start with Phase 1 (Foundation) to establish the data model and core infrastructure
2. Build services incrementally in Phases 2-11, testing each component thoroughly
3. Integrate components in Phase 12 (REST API & WebSocket)
4. Build the UI in Phase 13 (Dashboard)
5. Complete end-to-end integration and testing in Phase 14

Each phase builds upon previous work, ensuring a stable foundation before adding complexity. Property-based tests are included as optional sub-tasks to validate correctness properties, while unit tests validate specific behaviors.

The system is designed for reliability with transaction management, graceful shutdown, task locking, retry mechanisms, and comprehensive error handling throughout.
