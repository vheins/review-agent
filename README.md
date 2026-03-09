# PR Review Agent

GitHub Pull Request assistant with optional Gemini CLI delegation.

## Prerequisites

- Node.js >= 18
- GitHub CLI (`gh`) authenticated
- AI Executor (choose one):
  - Gemini CLI (default)
  - GitHub Copilot CLI

## Installation

```bash
yarn install
```

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DELEGATE=false          # Set to true to delegate reviews to AI
REVIEW_MODE=comment     # comment: add comments and reject PR, fix: auto-fix issues
REVIEW_INTERVAL=600     # Seconds between checks (continuous mode)
LOG_LEVEL=info          # info, warn, or error
WORKSPACE_DIR=./workspace  # Directory for cloning repositories
EXCLUDE_REPO_OWNERS=    # Comma-separated list of repo owners to exclude (e.g., owner1,owner2)
PR_SCOPE=authored,assigned,review-requested  # Comma-separated: authored, assigned, review-requested
AUTO_MERGE=false        # Auto-merge approved PRs (only in comment mode)

# AI Executor Configuration
AI_EXECUTOR=gemini      # gemini or copilot
GEMINI_ENABLED=true     # Enable/disable Gemini executor
GEMINI_MODEL=auto-3     # Gemini model selection (default: auto-3)
GEMINI_YOLO=false       # Auto-approve all Gemini actions
COPILOT_ENABLED=false   # Enable/disable Copilot executor
COPILOT_MODEL=claude-haiku-4.5  # Copilot model selection (default: claude-haiku-4.5)
COPILOT_YOLO=false      # Auto-approve all Copilot actions
```

### AI Executor Options

#### Gemini CLI (Default)
- Fast and efficient
- Requires Gemini CLI installation
- Set `AI_EXECUTOR=gemini` and `GEMINI_ENABLED=true`
- Choose model with `GEMINI_MODEL`
- Use `GEMINI_YOLO=true` for auto-approval

Available Gemini models:
- `auto-3` (default, recommended) - Let CLI choose best Gemini 3 model
- `auto-2.5` - Let CLI choose best Gemini 2.5 model
- `gemini-3.1-pro-preview` - Latest Gemini 3.1 Pro
- `gemini-3-flash-preview` - Fast Gemini 3 Flash
- `gemini-2.5-pro` - Gemini 2.5 Pro
- `gemini-2.5-flash` - Fast Gemini 2.5
- `gemini-2.5-flash-lite` - Lightweight Gemini 2.5

#### GitHub Copilot CLI
- Multiple model options (Claude, GPT, Gemini)
- Requires GitHub Copilot CLI installation
- Set `AI_EXECUTOR=copilot` and `COPILOT_ENABLED=true`
- Choose model with `COPILOT_MODEL`
- Use `COPILOT_YOLO=true` for auto-approval

#### Enable/Disable Executors
- `GEMINI_ENABLED=true/false` - Control Gemini availability
- `COPILOT_ENABLED=true/false` - Control Copilot availability
- Both can be enabled simultaneously for flexibility
- The active executor is determined by `AI_EXECUTOR`
- If selected executor is disabled, an error will be thrown

Available Copilot models (with cost multiplier):
- `claude-haiku-4.5` (default, 0.33x) - Fastest, most cost-effective
- `claude-sonnet-4.6` (1x) - Balanced, recommended for complex reviews
- `claude-sonnet-4.5` (1x) - Stable Sonnet
- `claude-sonnet-4` (1x) - Previous Sonnet
- `claude-opus-4.6` (3x) - Most capable, slower, expensive
- `claude-opus-4.5` (3x) - Previous Opus
- `gemini-3-pro-preview` (1x) - Google's latest
- `gpt-5.4` (1x) - Latest GPT
- `gpt-5.3-codex` (1x) - Code-optimized GPT 5.3
- `gpt-5.2-codex` (1x) - Code-optimized GPT 5.2
- `gpt-5.2` (1x) - GPT 5.2
- `gpt-5.1-codex-max` (1x) - Max context GPT 5.1
- `gpt-5.1-codex` (1x) - Code-optimized GPT 5.1
- `gpt-5.1` (1x) - GPT 5.1
- `gpt-5.1-codex-mini` (0.33x) - Lightweight GPT

## Review Guidelines

Edit `agents.md` to customize review instructions for the AI agent.

## Usage

### Review Specific PR

Review a specific PR by number:

```bash
yarn review 112
```

This will review only PR #112 instead of all open PRs.

### Run Once

```bash
yarn once
```

### Continuous Mode

```bash
yarn start
```

Runs continuously, checking for PRs every `REVIEW_INTERVAL` seconds.

### Dry Run Mode

Test delegation without cloning repositories or calling Gemini:

```bash
yarn dry-run
```

This will show what prompts would be sent to Gemini without executing them.

## How It Works

1. Fetches all open PRs you have access to using `gh search prs`
2. Prints PR summary
3. If `DELEGATE=true`:
   - For each PR:
     - Clones repository to `WORKSPACE_DIR/<repo-name>` if not exists
     - Checks out PR branch if repository already exists
     - Sends PR to selected AI executor (Gemini or Copilot) with review guidelines from `agents.md`
     - AI performs review and posts comments
     - Auto-merges if approved and `AUTO_MERGE=true` (comment mode only)

## Example Output

```
[INFO] Found 2 open PRs

#21 Improve payment processing
#19 Fix worker crash

[INFO] Using AI Executor: GEMINI
[INFO] Cloning owner/repo to workspace/owner-repo
[INFO] Delegating PR #21 to Gemini
[INFO] Repository owner2/repo2 exists, checking out branch feature-branch
[INFO] Delegating PR #19 to Gemini
```

## Desktop Application

Run the desktop app with GUI:

```bash
yarn app:dev
```

Features:
- Dashboard with real-time stats
- Configuration editor
- Live log streaming
- Context file editor (prompts and guidelines)
- Dark/Light theme
- Mobile responsive

## Notes

- Supports both Gemini CLI and GitHub Copilot CLI
- Master/main branch protection (forces comment mode, no auto-merge)
- Atomic comments (one comment per issue)
- Merge conflict detection
- Windows notifications for important events
