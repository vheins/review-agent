# PR Review Agent

GitHub Pull Request assistant with optional Gemini CLI delegation.

## Prerequisites

- Node.js >= 18
- GitHub CLI (`gh`) authenticated
- AI Executor (choose one):
  - Gemini CLI (default)
  - GitHub Copilot CLI
  - Kiro CLI
  - Claude Code CLI
  - Codex CLI
  - OpenCode CLI

## Installation

```bash
yarn install

# Rebuild native modules (required for better-sqlite3)
npm rebuild better-sqlite3
```

**Note**: If you encounter `Could not locate the bindings file` errors, run `npm rebuild better-sqlite3` to compile the native module for your Node.js version.

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
AI_EXECUTOR=gemini      # gemini, copilot, kiro, claude, codex, or opencode

# Gemini CLI
GEMINI_ENABLED=true
GEMINI_MODEL=auto-3

# GitHub Copilot CLI
COPILOT_ENABLED=false
COPILOT_MODEL=claude-haiku-4.5

# Kiro CLI
KIRO_ENABLED=false
KIRO_AGENT=auto

# Claude Code CLI
CLAUDE_ENABLED=false
CLAUDE_MODEL=sonnet
CLAUDE_AGENT=

# Codex CLI
CODEX_ENABLED=false
CODEX_MODEL=auto

# OpenCode CLI
OPENCODE_ENABLED=false
OPENCODE_MODEL=auto
OPENCODE_AGENT=
```

### AI Executor Options

#### 💎 Gemini CLI (Default)
- Fast and efficient
- Requires Gemini CLI installation
- Set `AI_EXECUTOR=gemini` and `GEMINI_ENABLED=true`
- Choose model with `GEMINI_MODEL`

Available Gemini models:
- `auto-3` (default, recommended) - Let CLI choose best Gemini 3 model
- `auto-2.5` - Let CLI choose best Gemini 2.5 model
- `gemini-3.1-pro-preview` - Latest Gemini 3.1 Pro
- `gemini-3-flash-preview` - Fast Gemini 3 Flash
- `gemini-2.5-pro` - Gemini 2.5 Pro
- `gemini-2.5-flash` - Fast Gemini 2.5
- `gemini-2.5-flash-lite` - Lightweight Gemini 2.5

#### 🤖 GitHub Copilot CLI
- Multiple model options (Claude, GPT, Gemini)
- Requires GitHub Copilot CLI installation
- Set `AI_EXECUTOR=copilot` and `COPILOT_ENABLED=true`
- Choose model with `COPILOT_MODEL`

#### 🥷 Kiro CLI
- Native Kiro integration
- Requires Kiro CLI installation
- Set `AI_EXECUTOR=kiro` and `KIRO_ENABLED=true`
- Choose agent with `KIRO_AGENT`

Available Kiro agents:
- `auto` (default, recommended) - Let Kiro choose the best agent
- `general-task-execution` - General-purpose agent
- `context-gatherer` - Context analysis agent
- `custom-agent-creator` - Custom agent creation

#### 🎭 Claude Code CLI
- Anthropic's official CLI
- Requires Claude Code installation
- Set `AI_EXECUTOR=claude` and `CLAUDE_ENABLED=true`
- Choose model with `CLAUDE_MODEL`
- Optional agent with `CLAUDE_AGENT`

Available Claude models:
- `sonnet` (default) - Latest Sonnet (alias)
- `opus` - Latest Opus (alias)
- `claude-sonnet-4-5-20250929` - Specific Sonnet version
- Full model names supported

#### 📝 Codex CLI
- Advanced code generation
- Requires Codex CLI installation
- Set `AI_EXECUTOR=codex` and `CODEX_ENABLED=true`
- Choose model with `CODEX_MODEL`

Available Codex models:
- `auto` (default) - Let Codex choose
- `o3` - Latest O3 model
- Custom models via config

#### 🔓 OpenCode CLI
- Open source code assistant
- Requires OpenCode installation
- Set `AI_EXECUTOR=opencode` and `OPENCODE_ENABLED=true`
- Choose model with `OPENCODE_MODEL`
- Optional agent with `OPENCODE_AGENT`

Available OpenCode models:
- `auto` (default) - Auto-select model
- Provider/model format (e.g., `anthropic/claude-3-sonnet`)
- Supports multiple providers

#### Enable/Disable Executors
- `GEMINI_ENABLED=true/false` - Control Gemini availability
- `COPILOT_ENABLED=true/false` - Control Copilot availability
- `KIRO_ENABLED=true/false` - Control Kiro availability
- `CLAUDE_ENABLED=true/false` - Control Claude availability
- `CODEX_ENABLED=true/false` - Control Codex availability
- `OPENCODE_ENABLED=true/false` - Control OpenCode availability
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

### Quick Start

To run the desktop app:

```bash
# Development mode (recommended)
yarn app:dev          # Linux/Mac
yarn app:dev:win      # Windows
```

The backend server will **automatically start** when you open the Electron app. No need to run it separately!

**What happens automatically:**
1. Backend server starts on port 3000 (if not already running)
2. Vite dev server starts on port 5173
3. Electron app launches with hot reload
4. Backend server stops when you close the app

### Manual Backend Server (Optional)

If you want to run the backend server separately:

```bash
# Terminal 1: Start backend server
yarn server

# Terminal 2: Start Electron app
yarn app:dev
```

### Troubleshooting

If you see WebSocket connection errors:
- Make sure the backend server is running on port 3000
- Check `.env` file for correct `API_PORT` setting
- See `RUNNING.md` for detailed troubleshooting

Run the desktop app with GUI:

```bash
# Development mode with hot reload
yarn app:dev          # Linux/Mac
yarn app:dev:win      # Windows

# Production mode
yarn app
```

Features:
- Dashboard with real-time stats
- Configuration editor
- Live log streaming
- Context file editor (prompts and guidelines)
- Dark/Light theme
- Mobile responsive
- **Hot reload in development** - Auto-reload on file changes

### Hot Reload Development

The desktop app supports hot reload for faster development:

1. **Nodemon** watches `electron/` directory
   - Auto-restarts on main process changes
   - Watches: `.js`, `.cjs`, `.html`, `.css`

2. **Electron-Reload** reloads renderer
   - Auto-reloads window on renderer changes
   - No full restart needed

See `electron/README.md` for detailed development guide.

## Notes

- Supports 6 AI executors: Gemini CLI, GitHub Copilot CLI, Kiro CLI, Claude Code CLI, Codex CLI, and OpenCode CLI
- Master/main branch protection (forces comment mode, no auto-merge)
- Atomic comments (one comment per issue)
- Merge conflict detection
- Windows notifications for important events

## Logging

All console output is automatically saved to daily log files in the `logs/` directory:

- **Log Format**: `review-agent-YYYY-MM-DD.log`
- **Retention**: 7 days (older logs are automatically deleted)
- **Location**: `/home/vheins/Agents/review-agent/logs/`
- **Content**: All info, warning, and error messages with timestamps

Example log entry:
```
[2024-03-10T08:39:28.123Z] [INFO] Starting PR review check...
[2024-03-10T08:39:29.456Z] [INFO] Found 2 open PRs
[2024-03-10T08:39:30.789Z] [ERROR] Failed to clone repository: permission denied
```

Logs are useful for:
- Debugging issues
- Tracking review history
- Monitoring agent performance
- Auditing automated actions
