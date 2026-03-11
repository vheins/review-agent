# Product Overview

PR Review Agent is an automated GitHub Pull Request review system with AI delegation capabilities.

## Core Functionality

- Automated PR monitoring and review across multiple repositories
- AI-powered code review using multiple executor options (Gemini, Copilot, Kiro, Claude, Codex, OpenCode)
- Two review modes: comment-based review or auto-fix
- Desktop Electron application with real-time dashboard
- REST API and WebSocket server for live updates
- Comprehensive metrics tracking and reporting

## Key Features

- Multi-repository PR scanning with configurable scope (authored, assigned, review-requested)
- Repository cloning and branch checkout automation
- Atomic comment posting per issue
- Auto-merge capability for approved PRs (with health checks)
- Master/main branch protection
- Merge conflict detection
- Windows notifications for important events
- Daily log rotation with 7-day retention
- Repository-specific configuration overrides
- Real-time WebSocket updates for dashboard

## Review Focus Areas

- Bug detection
- Security vulnerabilities
- Performance issues
- Code maintainability and readability
- Architectural concerns
- Missing test coverage

## Target Users

Development teams needing automated PR review assistance with flexible AI executor options and comprehensive monitoring capabilities.
