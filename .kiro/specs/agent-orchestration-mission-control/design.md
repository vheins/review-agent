# Design Document: Agent Orchestration Mission Control

## Overview

The Agent Orchestration Mission Control feature upgrades the PR Review Agent from a sequential executor into a deterministic orchestration layer. Instead of treating a PR as a single review job, the system manages it as a Mission_Session composed of policy decisions, specialized agent roles, safety gates, and operator-visible state transitions.

### Core Objectives

- Prioritize the most important work first using transparent queue policy scoring
- Separate orchestration into explicit agent roles that can be observed and improved independently
- Make risky automation decisions pass through confidence gates before execution
- Preserve a durable ledger of every decision, retry, branch, and operator override
- Surface human-dependent work in a dedicated inbox instead of burying it in logs
- Keep orchestration resilient across restarts, retries, and preemption events

### Capability Map

1. Policy-Based Queue Prioritization
2. Runbook-Driven Multi-Agent Execution
3. Operation Modes and Confidence Gates
4. Session Ledger and Human Override Inbox
5. Repository Memory and Scheduled Focus Windows
6. Recovery, Replay, and Interrupt Handling

## Architecture

### High-Level Components

- **Mission_Control_Service**
  - Owns Mission_Session lifecycle
  - Selects Runbook and Operation_Mode
  - Coordinates Agent_Role transitions

- **Queue_Policy_Engine**
  - Scores queued Work_Items
  - Re-scores on state change, interrupt, or policy update
  - Explains scoring factors for UI and ledger

- **Role_Execution_Manager**
  - Dispatches Scout, Reviewer, Fixer, Verifier, and Merger roles
  - Normalizes role output into common orchestration events

- **Confidence_Gate_Service**
  - Computes action confidence for auto-fix, resume, and merge paths
  - Emits pass or fail results with contributing factors

- **Session_Ledger_Service**
  - Appends immutable entries
  - Produces timeline views and filtering projections

- **Human_Override_Service**
  - Creates inbox items when stop conditions require human judgment
  - Applies operator resolution actions back into Mission_Session flow

- **Repository_Memory_Service**
  - Tracks recurring patterns and policy hints per repository
  - Exposes memory signals to scoring and role planning

- **Focus_Window_Scheduler**
  - Activates time-based orchestration strategies
  - Publishes effective mode and runbook context

### Primary State Model

A Mission_Session moves through these states:

- `queued`
- `selected`
- `running`
- `paused`
- `awaiting_human`
- `completed`
- `failed`
- `cancelled`

Mission_Steps inside a Mission_Session move independently through:

- `pending`
- `in_progress`
- `succeeded`
- `failed`
- `skipped`
- `paused`

### Agent Role Model

- **Scout**
  - Builds initial context
  - Identifies urgency, related signals, and recommended runbook branch

- **Reviewer**
  - Performs structured review analysis
  - Produces findings, severity breakdown, and remediation recommendations

- **Fixer**
  - Applies bounded, policy-approved remediations
  - Must emit explicit patch intent and targeted issue set

- **Verifier**
  - Validates tests, checks, and confidence prerequisites
  - Confirms whether state is safe to continue

- **Merger**
  - Executes merge or terminal approval actions only after all gates pass

## Data Design

### mission_sessions

- Purpose: top-level orchestration record per PR or repository event
- Fields:
  - `id`
  - `pull_request_id`
  - `repository_id`
  - `runbook_name`
  - `operation_mode`
  - `status`
  - `queue_priority_score`
  - `current_role`
  - `current_step_id`
  - `interrupt_state`
  - `focus_window_id`
  - `started_at`
  - `completed_at`
  - `created_at`
  - `updated_at`
- Indexes:
  - by `status`
  - by `repository_id, status`
  - by `pull_request_id`

### mission_steps

- Purpose: ordered steps within a Mission_Session
- Fields:
  - `id`
  - `mission_session_id`
  - `sequence_number`
  - `role_name`
  - `step_name`
  - `status`
  - `attempt_count`
  - `safe_boundary`
  - `started_at`
  - `completed_at`
  - `last_error_code`
  - `last_error_summary`
- Constraints:
  - unique `mission_session_id + sequence_number`

### queue_scores

- Purpose: persisted scoring explanation for queued work
- Fields:
  - `id`
  - `mission_session_id`
  - `base_score`
  - `final_score`
  - `age_score`
  - `sla_score`
  - `severity_score`
  - `blocking_score`
  - `repo_criticality_score`
  - `health_penalty`
  - `memory_adjustment`
  - `scored_at`

### session_ledger_entries

- Purpose: immutable audit-style event stream for mission activity
- Fields:
  - `id`
  - `mission_session_id`
  - `entry_index`
  - `category`
  - `actor_type`
  - `actor_name`
  - `status`
  - `summary`
  - `metadata_json`
  - `created_at`
- Constraints:
  - unique `mission_session_id + entry_index`
  - append-only write pattern

### override_inbox_items

- Purpose: collect items that need human decisions
- Fields:
  - `id`
  - `mission_session_id`
  - `blocking_reason`
  - `suggested_action`
  - `urgency`
  - `sla_impact`
  - `status`
  - `resolved_by`
  - `resolved_action`
  - `resolved_at`
  - `created_at`

### repository_memory_entries

- Purpose: repository-specific learned signals
- Fields:
  - `id`
  - `repository_id`
  - `memory_type`
  - `subject_key`
  - `signal_strength`
  - `source_count`
  - `last_seen_at`
  - `expires_at`
  - `metadata_json`

### focus_windows

- Purpose: time-based orchestration strategies
- Fields:
  - `id`
  - `scope_type`
  - `scope_id`
  - `window_name`
  - `start_time_local`
  - `end_time_local`
  - `runbook_name`
  - `operation_mode`
  - `priority_bias_json`
  - `is_active`

## Orchestration Algorithms

### Queue Scoring Algorithm

1. Load all `queued`, `paused`, and `awaiting_human` sessions that may compete for execution
2. Compute base score from age and current SLA pressure
3. Apply urgency increments for blocking, security severity, release relation, and hotfix signals
4. Apply penalties or boosts from repository criticality, PR health score, and repository memory
5. Apply focus window bias if a matching window is active
6. Persist detailed factor breakdown into `queue_scores`
7. Select highest score using deterministic tie-break order:
   - higher final score
   - earlier SLA deadline
   - older creation timestamp
   - lower mission session identifier

### Mission Execution Algorithm

1. Create or resume a Mission_Session
2. Select effective Runbook and Operation_Mode
3. Expand Runbook into ordered Mission_Steps
4. Dispatch next eligible Agent_Role step
5. Append structured ledger entries at role start and completion
6. Evaluate branch conditions and confidence gates after each critical step
7. If a stop condition requires human judgment, create inbox item and move to `awaiting_human`
8. If an interrupt arrives, pause at next safe boundary and re-score queue
9. Continue until terminal state is reached

### Confidence Gate Algorithm

Inputs:

- latest test results
- unresolved severity findings
- change size and file sensitivity
- executor reliability history
- false positive history
- repository mode and threshold policy

Output:

- confidence score from 0 to 100
- pass or fail result for the requested action
- structured factor list for ledger and UI

### Recovery Algorithm

1. On startup, load all Mission_Sessions in `running`, `paused`, and `awaiting_human`
2. Detect orphaned `in_progress` steps with no active worker heartbeat
3. If step is resumable at a safe boundary, mark as `paused`
4. If step outcome is ambiguous, create inbox item
5. Rebuild queue scores from persisted session, step, and policy state
6. Resume execution according to queue order and mode constraints

## API Surface

### Read APIs

- `GET /api/orchestration/queue`
  - Returns scored queue items with factor breakdown

- `GET /api/orchestration/sessions`
  - Returns mission sessions filtered by repository, status, role, and date

- `GET /api/orchestration/sessions/:id`
  - Returns mission summary, active step, and session ledger

- `GET /api/orchestration/inbox`
  - Returns Human Override Inbox items

- `GET /api/orchestration/repository-memory`
  - Returns repository memory summary and recent influential entries

- `GET /api/orchestration/focus-windows`
  - Returns active and scheduled focus windows

### Command APIs

- `POST /api/orchestration/queue/recalculate`
  - Re-scores eligible sessions

- `POST /api/orchestration/sessions/:id/pause`
  - Pauses at next safe boundary

- `POST /api/orchestration/sessions/:id/resume`
  - Re-enters queue and resumes when selected

- `POST /api/orchestration/sessions/:id/mode`
  - Switches operation mode within allowed policy bounds

- `POST /api/orchestration/inbox/:id/resolve`
  - Applies approve, reject, reroute, or defer resolution

- `POST /api/orchestration/focus-windows`
  - Creates or updates focus windows

## UI / Dashboard Design

### Overview Additions

- Queue pressure summary with top score drivers
- Active role lanes grouped by Scout, Reviewer, Fixer, Verifier, and Merger
- Human Override Inbox preview
- Paused sessions and active interrupts

### PR Detail Additions

- Mission session header with current runbook, operation mode, and confidence state
- Session ledger timeline
- Queue scoring explanation
- Human override context and suggested operator action

### Configuration Additions

- Runbook defaults per repository
- Operation mode selector
- Confidence threshold tuning
- Focus window editor
- Repository memory visibility and decay controls

## Reliability and Constraints

- All orchestration writes must be transactional
- Ledger entries must be append-only
- Queue re-scoring must remain deterministic for identical inputs
- Resume logic must not duplicate already committed safe-boundary steps
- Human override actions must be auditable and reversible only through explicit follow-up actions
- Operation mode restrictions must be enforced in backend orchestration, not just UI

## Testing Strategy

### Unit Coverage

- Queue score factor calculation
- Runbook expansion and validation
- Confidence gate evaluation
- Recovery classification
- Inbox resolution routing

### Property-Oriented Coverage

- deterministic queue ordering for identical inputs
- confidence score bounds
- append-only ledger sequence integrity
- safe-boundary replay protection
- focus window activation correctness

### End-to-End Coverage

- blocking PR preempts lower priority work
- low confidence auto-fix routes to Human Override Inbox
- restart resumes paused session without duplicating committed step
- operator resolves inbox item and mission continues
- dashboard updates session ledger and inbox in real time
