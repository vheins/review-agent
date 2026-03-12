import Joi from 'joi';

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
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  API_PORT: Joi.number().port().default(3000),
  REVIEW_INTERVAL: Joi.number().min(60).default(600),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  WORKSPACE_DIR: Joi.string().default('./workspace'),
  EXCLUDE_REPO_OWNERS: Joi.string().allow('').default(''),
  PR_SCOPE: Joi.string().default('authored,assigned,review-requested'),
  AUTO_MERGE: Joi.boolean().default(false),

  // Review
  DELEGATE: Joi.boolean().default(false),
  REVIEW_MODE: Joi.string().valid('comment', 'auto-fix').default('comment'),
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
  GEMINI_YOLO: Joi.boolean().default(false),

  // Copilot
  COPILOT_ENABLED: Joi.boolean().default(false),
  COPILOT_MODEL: Joi.string().default('claude-haiku-4.5'),
  COPILOT_YOLO: Joi.boolean().default(false),

  // Kiro
  KIRO_ENABLED: Joi.boolean().default(false),
  KIRO_AGENT: Joi.string().allow('').default('auto'),
  KIRO_YOLO: Joi.boolean().default(false),

  // Claude
  CLAUDE_ENABLED: Joi.boolean().default(false),
  CLAUDE_MODEL: Joi.string().default('sonnet'),
  CLAUDE_AGENT: Joi.string().allow('').default(''),
  CLAUDE_YOLO: Joi.boolean().default(false),

  // Codex
  CODEX_ENABLED: Joi.boolean().default(false),
  CODEX_MODEL: Joi.string().default('auto'),
  CODEX_YOLO: Joi.boolean().default(false),

  // OpenCode
  OPENCODE_ENABLED: Joi.boolean().default(false),
  OPENCODE_MODEL: Joi.string().default('auto'),
  OPENCODE_AGENT: Joi.string().allow('').default(''),
  OPENCODE_YOLO: Joi.boolean().default(false),
});
