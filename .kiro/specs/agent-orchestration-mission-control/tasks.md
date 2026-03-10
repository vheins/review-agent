# Implementation Plan: Agent Orchestration Mission Control

## Overview

This implementation plan introduces a deterministic orchestration layer for the PR Review Agent. The work is organized into phases that start from storage and policy foundations, then add role-based execution, safety controls, operator surfaces, and recovery guarantees.

**Technology Stack**: Node.js, Electron, SQLite, Express.js, WebSocket, Playwright

**Implementation Approach**: foundation first, then policy engine, then orchestration runtime, then operator UI, followed by reliability and recovery hardening.

## Tasks

### Phase 1: Orchestration Foundation

- [ ] 1. Create orchestration database schema
  - Create tables for mission_sessions, mission_steps, queue_scores, session_ledger_entries, override_inbox_items, repository_memory_entries, and focus_windows
  - Add indexes for repository, PR, status, and chronological ledger access
  - Add migration coverage for append-only ledger constraints
  - _Requirements: 6.1, 12.1, 13.1_

- [ ] 2. Create orchestration domain services
  - Create MissionControlService skeleton
  - Create QueuePolicyEngine skeleton
  - Create SessionLedgerService skeleton
  - Create HumanOverrideService skeleton
  - Create RepositoryMemoryService skeleton
  - _Requirements: 1.1, 2.1, 6.1, 7.1, 9.1_

- [ ] 3. Add orchestration repository and persistence helpers
  - Add storage helpers for mission sessions and steps
  - Add ledger append helpers
  - Add inbox item persistence helpers
  - _Requirements: 6.2, 7.2, 12.2_

- [ ] 4. Write foundation tests
  - Add unit tests for mission session creation
  - Add unit tests for append-only ledger write flow
  - Add property test for ledger entry ordering integrity
  - _Requirements: 6.1, 6.6, 13.4_

- [ ] 5. Checkpoint
  - Ensure orchestration foundation tests pass before policy work continues

### Phase 2: Queue Policy Engine

- [ ] 6. Implement queue scoring model
  - Add factor inputs for age, SLA, severity, blocking, repository criticality, health score, and repository memory
  - Persist factor breakdown into queue_scores
  - Define deterministic tie-break behavior
  - _Requirements: 1.1, 1.3, 1.6_

- [ ] 7. Implement queue re-scoring triggers
  - Re-score on PR updates, interrupt events, policy changes, and focus window changes
  - Add queue refresh broadcast hooks for dashboard updates
  - _Requirements: 1.5, 8.2, 11.5_

- [ ] 8. Add queue policy configuration support
  - Allow global and repository-level queue weight overrides
  - Validate queue policy payloads before activation
  - _Requirements: 1.2, 3.5, 12.6_

- [ ] 9. Write queue policy tests
  - Add unit tests for score factor aggregation
  - Add property test for deterministic ordering
  - Add unit tests for policy override fallback behavior
  - _Requirements: 1.2, 1.3, 13.3_

- [ ] 10. Checkpoint
  - Verify queue engine behavior and deterministic ordering before mission runtime integration

### Phase 3: Multi-Agent Role Runtime

- [ ] 11. Implement runbook definitions and validation
  - Define built-in runbooks for review-only, test-and-heal, fix-safe, full-auto, and security triage
  - Add validation for entry conditions, branches, and terminal states
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 12. Implement Agent_Role orchestration
  - Add role dispatch flow for Scout, Reviewer, Fixer, Verifier, and Merger
  - Normalize role events into common mission step lifecycle events
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 13. Implement mission session execution flow
  - Expand runbook into mission_steps
  - Track current role and current step
  - Append ledger entries for every role transition
  - _Requirements: 2.4, 3.3, 6.2_

- [ ] 14. Integrate current review lifecycle with mission runtime
  - Wrap existing test-and-heal, assignment, review, auto-fix, re-review, and merge flows as mission steps
  - Preserve backward compatibility for existing webhook entrypoints
  - _Requirements: 2.2, 3.1, 12.2_

- [ ] 15. Write mission runtime tests
  - Add unit tests for role step sequencing
  - Add end-to-end tests for built-in runbooks
  - Add property test for safe-boundary replay protection
  - _Requirements: 2.5, 3.2, 13.5_

- [ ] 16. Checkpoint
  - Verify a PR can complete a mission session end-to-end through the new orchestration layer

### Phase 4: Operation Modes and Confidence Gates

- [ ] 17. Implement operation mode enforcement
  - Add mode registry for observe, review-only, fix-safe, and full-auto
  - Enforce forbidden actions in backend mission runtime
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 18. Implement confidence scoring service
  - Add confidence inputs from tests, findings, change size, executor history, false positives, and repository policy
  - Record confidence results in session ledger metadata
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 19. Wire confidence gates into critical steps
  - Gate auto-fix, resume, and merge decisions
  - Route failing decisions to Human Override Inbox
  - _Requirements: 4.6, 5.3, 7.1_

- [ ] 20. Add configuration support for mode and threshold policies
  - Persist defaults globally and per repository
  - Validate mode and threshold combinations
  - _Requirements: 4.5, 5.6_

- [ ] 21. Write safety control tests
  - Add unit tests for operation mode denials
  - Add property test for confidence score bounds
  - Add end-to-end test for low-confidence route to inbox
  - _Requirements: 4.3, 5.3, 5.5_

- [ ] 22. Checkpoint
  - Verify unsafe actions are blocked correctly before operator UI work begins

### Phase 5: Human Override Inbox and Repository Memory

- [ ] 23. Implement Human Override Inbox lifecycle
  - Create inbox items from stop conditions
  - Support approve, reject, reroute, and defer resolution actions
  - Resume or terminate mission sessions deterministically after resolution
  - _Requirements: 7.1, 7.3, 7.4_

- [ ] 24. Implement Repository Memory storage and retrieval
  - Capture recurring issue types, hot files, preferred reviewers, unstable checks, and policy hints
  - Add decay or expiry handling for stale memory
  - _Requirements: 9.1, 9.5_

- [ ] 25. Integrate Repository Memory into scoring and role planning
  - Feed repository memory into queue scoring and runbook planning
  - Record memory usage in the session ledger
  - _Requirements: 9.2, 9.3, 9.6_

- [ ] 26. Write inbox and memory tests
  - Add unit tests for inbox resolution branching
  - Add unit tests for memory decay
  - Add end-to-end test for repository memory affecting queue rank
  - _Requirements: 7.4, 9.5, 9.6_

- [ ] 27. Checkpoint
  - Verify blocked work can be surfaced and resumed through explicit operator action

### Phase 6: Interrupts, Focus Windows, and Recovery

- [ ] 28. Implement interrupt detection and preemption
  - Detect security-critical, release-blocking, hotfix, and SLA breach signals
  - Pause lower-priority sessions at safe boundaries
  - _Requirements: 8.1, 8.3, 8.4_

- [ ] 29. Implement focus window scheduler
  - Add global and repository-specific focus windows
  - Apply window-specific runbooks, modes, and priority biases
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 30. Implement orchestration recovery flow
  - Recover running, paused, and awaiting_human sessions after restart
  - Detect orphaned mission steps and classify them for resume or inbox routing
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 31. Write recovery and scheduler tests
  - Add property test for focus window activation correctness
  - Add end-to-end restart recovery test
  - Add end-to-end preemption and resume test
  - _Requirements: 8.6, 10.6, 13.1_

- [ ] 32. Checkpoint
  - Verify orchestration can survive restart and queue reshaping events

### Phase 7: API Surface and Dashboard

- [ ] 33. Add orchestration API endpoints
  - Implement queue, sessions, session detail, inbox, repository memory, and focus window reads
  - Implement pause, resume, recalculate, resolve inbox, mode switch, and focus window writes
  - _Requirements: 6.5, 12.2, 12.3_

- [ ] 34. Add WebSocket event streams for orchestration
  - Broadcast queue score changes, role transitions, inbox changes, and recovery events
  - _Requirements: 2.3, 11.5, 13.6_

- [ ] 35. Upgrade Electron dashboard overview
  - Add queue pressure panel
  - Add active role lanes
  - Add paused session and inbox summary
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 36. Upgrade PR detail views
  - Add mission session header, ledger timeline, queue score explanation, and override context
  - _Requirements: 6.4, 7.2, 11.4_

- [ ] 37. Upgrade configuration views
  - Add runbook defaults, operation mode controls, confidence thresholds, focus window editor, and repository memory visibility
  - _Requirements: 3.6, 4.4, 5.6, 10.4_

- [ ] 38. Add orchestration UI smoke coverage
  - Extend Playwright Electron tests for inbox, queue policy, mission detail, and mobile-width responsiveness
  - _Requirements: 11.6, 12.3_

- [ ] 39. Checkpoint
  - Verify orchestration state is visible and operable from the dashboard

### Phase 8: Hardening and Rollout

- [ ] 40. Add audit integration for orchestration writes
  - Ensure all command APIs and mission mutations emit audit records
  - _Requirements: 6.2, 12.4_

- [ ] 41. Add performance safeguards
  - Measure queue re-score latency
  - Add caching or projection tables for heavy dashboard queries if needed
  - _Requirements: 1.5, 11.5_

- [ ] 42. Add rollout and migration protections
  - Preserve compatibility with existing review workflow while orchestration is phased in
  - Add feature flags for mission-control activation paths
  - _Requirements: 2.2, 4.1, 13.1_

- [ ] 43. Write final regression and recovery suite
  - Cover interruption, inbox resolution, low-confidence stops, restart recovery, and mode enforcement
  - _Requirements: 4.3, 5.3, 7.4, 13.1_

- [ ] 44. Final checkpoint
  - Ensure full orchestration workflow is stable, observable, and ready for incremental rollout
