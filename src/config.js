import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dbManager } from './database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  delegate: process.env.DELEGATE === 'true',
  reviewMode: process.env.REVIEW_MODE || 'comment',
  reviewInterval: parseInt(process.env.REVIEW_INTERVAL || '600', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  workspaceDir: process.env.WORKSPACE_DIR || './workspace',
  dryRun: process.argv.includes('--dry-run'),
  excludeRepoOwners: process.env.EXCLUDE_REPO_OWNERS
    ? process.env.EXCLUDE_REPO_OWNERS.split(',').map(o => o.trim())
    : [],
  prScope: process.env.PR_SCOPE
    ? process.env.PR_SCOPE.split(',').map(s => s.trim())
    : ['authored', 'assigned', 'review-requested'],
  autoMerge: process.env.AUTO_MERGE === 'true',
  aiExecutor: process.env.AI_EXECUTOR || 'gemini', 
  geminiEnabled: process.env.GEMINI_ENABLED !== 'false', 
  geminiModel: process.env.GEMINI_MODEL || 'auto-3',
  copilotEnabled: process.env.COPILOT_ENABLED === 'true',
  copilotModel: process.env.COPILOT_MODEL || 'claude-haiku-4.5',
  kiroEnabled: process.env.KIRO_ENABLED === 'true',
  kiroAgent: process.env.KIRO_AGENT || 'auto',
  claudeEnabled: process.env.CLAUDE_ENABLED === 'true',
  claudeModel: process.env.CLAUDE_MODEL || 'sonnet',
  claudeAgent: process.env.CLAUDE_AGENT || '',
  codexEnabled: process.env.CODEX_ENABLED === 'true',
  codexModel: process.env.CODEX_MODEL || 'auto',
  opencodeEnabled: process.env.OPENCODE_ENABLED === 'true',
  opencodeModel: process.env.OPENCODE_MODEL || 'auto',
  opencodeAgent: process.env.OPENCODE_AGENT || '',
  severityThreshold: parseInt(process.env.SEVERITY_THRESHOLD || '10', 10),
  severityCritical: parseInt(process.env.SEVERITY_CRITICAL || '5', 10),
  severityHigh: parseInt(process.env.SEVERITY_HIGH || '3', 10),
  severityMedium: parseInt(process.env.SEVERITY_MEDIUM || '2', 10),
  severityLow: parseInt(process.env.SEVERITY_LOW || '1', 10)
};

class ConfigurationManager {
  constructor() {
    this.defaultConfig = { ...config };
    this.repoConfigs = new Map();
  }

  async loadFromFile(filePath) {
    if (!await fs.pathExists(filePath)) {
      return null;
    }

    const content = await fs.readFile(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    
    let parsed;
    if (ext === '.json') {
      parsed = JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      parsed = yaml.load(content);
    } else {
      throw new Error(`Unsupported configuration format: ${ext}`);
    }

    return this.validateConfig(parsed);
  }

  validateConfig(config) {
    // Basic validation logic
    if (config.reviewInterval && typeof config.reviewInterval !== 'number') {
      throw new Error('reviewInterval must be a number');
    }
    return config;
  }

  async getRepoConfig(repositoryId) {
    if (this.repoConfigs.has(repositoryId)) {
      return this.repoConfigs.get(repositoryId);
    }

    if (!dbManager.isAvailable()) {
      return this.defaultConfig;
    }

    const row = dbManager.db.prepare('SELECT config_data FROM repository_config WHERE repository_id = ?').get(repositoryId);
    
    if (row) {
      const repoConfig = JSON.parse(row.config_data);
      const merged = { ...this.defaultConfig, ...repoConfig };
      this.repoConfigs.set(repositoryId, merged);
      return merged;
    }

    return this.defaultConfig;
  }

  async saveRepoConfig(repositoryId, configData, updatedBy = 'system') {
    const validated = this.validateConfig(configData);
    const configJson = JSON.stringify(validated);

    if (!dbManager.isAvailable()) {
      throw new Error('Database not available to save configuration');
    }

    return dbManager.transaction(() => {
      // Get current version if exists
      const current = dbManager.db.prepare('SELECT version FROM repository_config WHERE repository_id = ?').get(repositoryId);
      const version = current ? current.version + 1 : 1;

      dbManager.db.prepare(`
        INSERT INTO repository_config (repository_id, config_data, version, updated_at, updated_by)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(repository_id) DO UPDATE SET
          config_data = excluded.config_data,
          version = excluded.version,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
      `).run(repositoryId, configJson, version, updatedBy);

      // Log to audit trail
      dbManager.db.prepare(`
        INSERT INTO audit_trail (timestamp, action_type, actor_type, actor_id, resource_type, resource_id, action_details)
        VALUES (CURRENT_TIMESTAMP, 'config_update', 'user', ?, 'repository', ?, ?)
      `).run(updatedBy, repositoryId.toString(), JSON.stringify({ version, config: validated }));

      this.repoConfigs.set(repositoryId, { ...this.defaultConfig, ...validated });
      return true;
    })();
  }
}

export const configManager = new ConfigurationManager();
export default configManager;
