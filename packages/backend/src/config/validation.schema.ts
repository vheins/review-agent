import Joi from 'joi';
import { resolveWorkspaceDir } from './workspace-path.util.js';

/**
 * Configuration Validation Schema
 *
 * Joi schema for validating environment variables at startup.
 * Ensures all required configuration values are present and valid.
 *
 * Requirements: 9.4
 */
export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  API_PORT: Joi.number().port().default(3000),
  WORKSPACE_DIR: Joi.string().default(resolveWorkspaceDir()),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  DRY_RUN: Joi.boolean().default(false),

  // GitHub
  GITHUB_TOKEN: Joi.string().allow('').default(''),
  GITHUB_USERNAME: Joi.string().allow('').default(''),

  // Review Engine
  DELEGATE: Joi.boolean().default(false),
  REVIEW_MODE: Joi.string().valid('comment', 'auto-fix').default('comment'),
  REVIEW_INTERVAL: Joi.number().min(60).default(600),
  AUTO_MERGE: Joi.boolean().default(false),
  PR_SCOPE: Joi.string().default('authored,assigned,review-requested,involves'),
  STALE_INVOLVES_REVIEW_DAYS: Joi.number().min(1).default(3),
  EXCLUDE_REPO_OWNERS: Joi.string().allow('').default(''),

  // Issue Sync
  ISSUE_SYNC_ENABLED: Joi.boolean().default(true),
  ISSUE_INTERVAL: Joi.number().min(60).default(600),
  FIX_ISSUE: Joi.boolean().default(false),

  // Severity Scoring
  SEVERITY_THRESHOLD: Joi.number().min(0).default(10),
  SEVERITY_CRITICAL: Joi.number().min(0).default(5),
  SEVERITY_HIGH: Joi.number().min(0).default(3),
  SEVERITY_MEDIUM: Joi.number().min(0).default(2),
  SEVERITY_LOW: Joi.number().min(0).default(1),

  // AI Executor
  AI_EXECUTOR: Joi.string()
    .valid('gemini', 'copilot', 'kiro', 'claude', 'codex', 'opencode')
    .default('gemini'),

  // Gemini
  GEMINI_ENABLED: Joi.boolean().default(true),
  GEMINI_MODEL: Joi.string().default('auto-3'),
  GEMINI_YOLO: Joi.boolean().default(true),

  // Copilot
  COPILOT_ENABLED: Joi.boolean().default(false),
  COPILOT_MODEL: Joi.string().default('claude-haiku-4.5'),
  COPILOT_YOLO: Joi.boolean().default(true),

  // Kiro
  KIRO_ENABLED: Joi.boolean().default(false),
  KIRO_AGENT: Joi.string().allow('').default('auto'),
  KIRO_YOLO: Joi.boolean().default(true),

  // Claude
  CLAUDE_ENABLED: Joi.boolean().default(false),
  CLAUDE_MODEL: Joi.string().default('sonnet'),
  CLAUDE_AGENT: Joi.string().allow('').default(''),
  CLAUDE_YOLO: Joi.boolean().default(true),

  // Codex
  CODEX_ENABLED: Joi.boolean().default(false),
  CODEX_MODEL: Joi.string().default('auto'),
  CODEX_YOLO: Joi.boolean().default(true),

  // OpenCode
  OPENCODE_ENABLED: Joi.boolean().default(false),
  OPENCODE_MODEL: Joi.string().default('auto'),
  OPENCODE_AGENT: Joi.string().allow('').default(''),
  OPENCODE_YOLO: Joi.boolean().default(true),
  OPENCODE_BIN: Joi.string().allow('').default('opencode'),

  // Discord Bot
  DISCORD_BOT_ENABLED: Joi.boolean().default(false),
  DISCORD_BOT_TOKEN: Joi.string().allow('').default(''),
  DISCORD_GUILD_ID: Joi.string().allow('').default(''),
  DISCORD_VOICE_CHANNEL_ID: Joi.string().allow('').default(''),
  DISCORD_SOUNDS_DIR: Joi.string().allow('').optional(),

  // Text-to-Speech
  TTS_API_URL: Joi.string().uri().optional().default('http://localhost:20128/v1/audio/speech'),
  TTS_API_KEY: Joi.string().allow('').default(''),
  TTS_INCLUDED_OWNERS: Joi.string().allow('').default(''),
  EXCLUDED_TTS_OWNERS: Joi.string().allow('').default(''),
  TTS_MUTE_START_HOUR: Joi.number().min(0).max(23).default(9),
  TTS_MUTE_END_HOUR: Joi.number().min(0).max(23).default(10),
});
