# PR Review Agent

GitHub Pull Request assistant with optional Gemini CLI delegation.

## Prerequisites

- Node.js >= 18
- GitHub CLI (`gh`) authenticated
- Gemini CLI (if using delegation mode)

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
DELEGATE=false          # Set to true to delegate reviews to Gemini
REVIEW_MODE=comment     # comment: add comments and reject PR, fix: auto-fix issues
REVIEW_INTERVAL=600     # Seconds between checks (continuous mode)
LOG_LEVEL=info          # info, warn, or error
WORKSPACE_DIR=./workspace  # Directory for cloning repositories
EXCLUDE_REPO_OWNERS=    # Comma-separated list of repo owners to exclude (e.g., owner1,owner2)
PR_SCOPE=authored,assigned,review-requested  # Comma-separated: authored, assigned, review-requested
```

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

1. Fetches all open PRs you have access to using `gh search prs --author=@me`
2. Prints PR summary
3. If `DELEGATE=true`:
   - For each PR:
     - Clones repository to `WORKSPACE_DIR/<repo-name>` if not exists
     - Checks out PR branch if repository already exists
     - Sends PR to Gemini CLI with review guidelines from `agents.md`

## Example Output

```
[INFO] Found 2 open PRs

#21 Improve payment processing
#19 Fix worker crash

[INFO] Cloning owner/repo to workspace/owner-repo
[INFO] Delegating PR #21 to Gemini
[INFO] Repository owner2/repo2 exists, checking out branch feature-branch
[INFO] Delegating PR #19 to Gemini
```

## Notes

- This is Phase 1: PR detection and delegation only
- No diff fetching, analysis, or commenting yet
- Framework-agnostic: works with any repository
