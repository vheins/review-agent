import { registerAs } from '@nestjs/config';

/**
 * AI Executor Configuration
 * 
 * Typed configuration for AI executor settings.
 * Supports multiple AI executors: Gemini, Copilot, Kiro, Claude, Codex, OpenCode.
 * 
 * Requirements: 9.1, 9.2, 9.5
 */
export interface ExecutorSettings {
  enabled: boolean;
  model: string;
  yolo: boolean;
  agent?: string;
}

export interface AiExecutorConfig {
  executor: string;
  gemini: ExecutorSettings;
  copilot: ExecutorSettings;
  kiro: ExecutorSettings;
  claude: ExecutorSettings;
  codex: ExecutorSettings;
  opencode: ExecutorSettings;
}

export default registerAs('aiExecutor', (): AiExecutorConfig => ({
  executor: process.env.AI_EXECUTOR || 'gemini',
  gemini: {
    enabled: process.env.GEMINI_ENABLED === 'true',
    model: process.env.GEMINI_MODEL || 'auto-3',
    yolo: process.env.GEMINI_YOLO === 'true',
  },
  copilot: {
    enabled: process.env.COPILOT_ENABLED === 'true',
    model: process.env.COPILOT_MODEL || 'claude-haiku-4.5',
    yolo: process.env.COPILOT_YOLO === 'true',
  },
  kiro: {
    enabled: process.env.KIRO_ENABLED === 'true',
    model: process.env.KIRO_AGENT || 'auto',
    yolo: process.env.KIRO_YOLO === 'true',
    agent: process.env.KIRO_AGENT,
  },
  claude: {
    enabled: process.env.CLAUDE_ENABLED === 'true',
    model: process.env.CLAUDE_MODEL || 'sonnet',
    yolo: process.env.CLAUDE_YOLO === 'true',
    agent: process.env.CLAUDE_AGENT,
  },
  codex: {
    enabled: process.env.CODEX_ENABLED === 'true',
    model: process.env.CODEX_MODEL || 'auto',
    yolo: process.env.CODEX_YOLO === 'true',
  },
  opencode: {
    enabled: process.env.OPENCODE_ENABLED === 'true',
    model: process.env.OPENCODE_MODEL || 'auto',
    yolo: process.env.OPENCODE_YOLO === 'true',
    agent: process.env.OPENCODE_AGENT,
  },
}));
