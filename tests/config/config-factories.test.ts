import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import appConfig from '../../src/config/app.config.js';
import reviewConfig from '../../src/config/review.config.js';
import aiExecutorConfig from '../../src/config/ai-executor.config.js';
import databaseConfig from '../../src/config/database.config.js';

/**
 * Configuration Factory Tests
 * 
 * Tests for configuration factory functions that load environment variables.
 * These tests verify that environment variables are correctly parsed and
 * default values are applied when variables are not set.
 * 
 * Requirements: 9.1, 9.2, 9.5
 */
describe('Configuration Factories', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('appConfig', () => {
    it('should load environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.API_PORT = '4000';
      process.env.REVIEW_INTERVAL = '900';
      process.env.LOG_LEVEL = 'debug';
      process.env.WORKSPACE_DIR = '/custom/workspace';
      process.env.AUTO_MERGE = 'true';

      const config = appConfig();

      expect(config.nodeEnv).toBe('production');
      expect(config.apiPort).toBe(4000);
      expect(config.reviewInterval).toBe(900);
      expect(config.logLevel).toBe('debug');
      expect(config.workspaceDir).toBe('/custom/workspace');
      expect(config.autoMerge).toBe(true);
    });

    it('should apply default values when env vars not set', () => {
      delete process.env.NODE_ENV;
      delete process.env.API_PORT;
      delete process.env.REVIEW_INTERVAL;
      delete process.env.LOG_LEVEL;
      delete process.env.WORKSPACE_DIR;
      delete process.env.AUTO_MERGE;

      const config = appConfig();

      expect(config.nodeEnv).toBe('development');
      expect(config.apiPort).toBe(3000);
      expect(config.reviewInterval).toBe(600);
      expect(config.logLevel).toBe('info');
      expect(config.workspaceDir).toBe('./workspace');
      expect(config.autoMerge).toBe(false);
    });

    it('should parse PR_SCOPE as array', () => {
      process.env.PR_SCOPE = 'authored,assigned';

      const config = appConfig();

      expect(Array.isArray(config.prScope)).toBe(true);
      expect(config.prScope).toEqual(['authored', 'assigned']);
    });

    it('should use default PR_SCOPE when not set', () => {
      delete process.env.PR_SCOPE;

      const config = appConfig();

      expect(config.prScope).toEqual(['authored', 'assigned', 'review-requested']);
    });

    it('should parse EXCLUDE_REPO_OWNERS as array', () => {
      process.env.EXCLUDE_REPO_OWNERS = 'owner1,owner2,owner3';

      const config = appConfig();

      expect(Array.isArray(config.excludeRepoOwners)).toBe(true);
      expect(config.excludeRepoOwners).toEqual(['owner1', 'owner2', 'owner3']);
    });

    it('should return empty array for EXCLUDE_REPO_OWNERS when not set', () => {
      delete process.env.EXCLUDE_REPO_OWNERS;

      const config = appConfig();

      expect(config.excludeRepoOwners).toEqual([]);
    });

    it('should trim whitespace from array values', () => {
      process.env.PR_SCOPE = ' authored , assigned , review-requested ';
      process.env.EXCLUDE_REPO_OWNERS = ' owner1 , owner2 ';

      const config = appConfig();

      expect(config.prScope).toEqual(['authored', 'assigned', 'review-requested']);
      expect(config.excludeRepoOwners).toEqual(['owner1', 'owner2']);
    });

    it('should parse boolean AUTO_MERGE correctly', () => {
      process.env.AUTO_MERGE = 'true';
      expect(appConfig().autoMerge).toBe(true);

      process.env.AUTO_MERGE = 'false';
      expect(appConfig().autoMerge).toBe(false);

      delete process.env.AUTO_MERGE;
      expect(appConfig().autoMerge).toBe(false);
    });
  });

  describe('reviewConfig', () => {
    it('should load environment variables', () => {
      process.env.DELEGATE = 'true';
      process.env.REVIEW_MODE = 'auto-fix';
      process.env.SEVERITY_THRESHOLD = '15';
      process.env.SEVERITY_CRITICAL = '10';
      process.env.SEVERITY_HIGH = '5';
      process.env.SEVERITY_MEDIUM = '3';
      process.env.SEVERITY_LOW = '2';

      const config = reviewConfig();

      expect(config.delegate).toBe(true);
      expect(config.reviewMode).toBe('auto-fix');
      expect(config.severityThreshold).toBe(15);
      expect(config.severityCritical).toBe(10);
      expect(config.severityHigh).toBe(5);
      expect(config.severityMedium).toBe(3);
      expect(config.severityLow).toBe(2);
    });

    it('should apply default values', () => {
      delete process.env.DELEGATE;
      delete process.env.REVIEW_MODE;
      delete process.env.SEVERITY_THRESHOLD;
      delete process.env.SEVERITY_CRITICAL;
      delete process.env.SEVERITY_HIGH;
      delete process.env.SEVERITY_MEDIUM;
      delete process.env.SEVERITY_LOW;

      const config = reviewConfig();

      expect(config.delegate).toBe(false);
      expect(config.reviewMode).toBe('comment');
      expect(config.severityThreshold).toBe(10);
      expect(config.severityCritical).toBe(5);
      expect(config.severityHigh).toBe(3);
      expect(config.severityMedium).toBe(2);
      expect(config.severityLow).toBe(1);
    });

    it('should parse DELEGATE as boolean', () => {
      process.env.DELEGATE = 'true';
      expect(reviewConfig().delegate).toBe(true);

      process.env.DELEGATE = 'false';
      expect(reviewConfig().delegate).toBe(false);

      delete process.env.DELEGATE;
      expect(reviewConfig().delegate).toBe(false);
    });

    it('should parse severity scores as numbers', () => {
      process.env.SEVERITY_THRESHOLD = '20';
      process.env.SEVERITY_CRITICAL = '8';

      const config = reviewConfig();

      expect(typeof config.severityThreshold).toBe('number');
      expect(typeof config.severityCritical).toBe('number');
      expect(config.severityThreshold).toBe(20);
      expect(config.severityCritical).toBe(8);
    });
  });

  describe('aiExecutorConfig', () => {
    it('should load environment variables', () => {
      process.env.AI_EXECUTOR = 'copilot';
      process.env.GEMINI_ENABLED = 'true';
      process.env.GEMINI_MODEL = 'gemini-ultra';
      process.env.GEMINI_YOLO = 'true';
      process.env.COPILOT_ENABLED = 'true';
      process.env.COPILOT_MODEL = 'gpt-4';
      process.env.KIRO_AGENT = 'custom-agent';

      const config = aiExecutorConfig();

      expect(config.executor).toBe('copilot');
      expect(config.gemini.enabled).toBe(true);
      expect(config.gemini.model).toBe('gemini-ultra');
      expect(config.gemini.yolo).toBe(true);
      expect(config.copilot.enabled).toBe(true);
      expect(config.copilot.model).toBe('gpt-4');
      expect(config.kiro.agent).toBe('custom-agent');
    });

    it('should apply default values', () => {
      delete process.env.AI_EXECUTOR;
      delete process.env.GEMINI_ENABLED;
      delete process.env.GEMINI_MODEL;
      delete process.env.COPILOT_ENABLED;

      const config = aiExecutorConfig();

      expect(config.executor).toBe('gemini');
      expect(config.gemini.enabled).toBe(false);
      expect(config.gemini.model).toBe('auto-3');
      expect(config.copilot.enabled).toBe(false);
    });

    it('should load all executor settings', () => {
      const config = aiExecutorConfig();

      expect(config.gemini).toBeDefined();
      expect(config.copilot).toBeDefined();
      expect(config.kiro).toBeDefined();
      expect(config.claude).toBeDefined();
      expect(config.codex).toBeDefined();
      expect(config.opencode).toBeDefined();
    });

    it('should parse boolean flags correctly', () => {
      process.env.GEMINI_ENABLED = 'true';
      process.env.GEMINI_YOLO = 'true';
      process.env.COPILOT_ENABLED = 'false';

      const config = aiExecutorConfig();

      expect(config.gemini.enabled).toBe(true);
      expect(config.gemini.yolo).toBe(true);
      expect(config.copilot.enabled).toBe(false);
    });

    it('should handle optional agent fields', () => {
      process.env.KIRO_AGENT = 'kiro-agent';
      process.env.CLAUDE_AGENT = 'claude-agent';
      process.env.OPENCODE_AGENT = 'opencode-agent';

      const config = aiExecutorConfig();

      expect(config.kiro.agent).toBe('kiro-agent');
      expect(config.claude.agent).toBe('claude-agent');
      expect(config.opencode.agent).toBe('opencode-agent');
    });

    it('should use default models for each executor', () => {
      delete process.env.GEMINI_MODEL;
      delete process.env.COPILOT_MODEL;
      delete process.env.KIRO_AGENT;
      delete process.env.CLAUDE_MODEL;
      delete process.env.CODEX_MODEL;
      delete process.env.OPENCODE_MODEL;

      const config = aiExecutorConfig();

      expect(config.gemini.model).toBe('auto-3');
      expect(config.copilot.model).toBe('claude-haiku-4.5');
      expect(config.kiro.model).toBe('auto');
      expect(config.claude.model).toBe('sonnet');
      expect(config.codex.model).toBe('auto');
      expect(config.opencode.model).toBe('auto');
    });
  });

  describe('databaseConfig', () => {
    it('should always use sqlite type', () => {
      const config = databaseConfig();

      expect(config.type).toBe('sqlite');
    });

    it('should set database path', () => {
      const config = databaseConfig();

      expect(config.database).toContain('data/pr-review.db');
      expect(typeof config.database).toBe('string');
    });

    it('should set synchronize based on environment', () => {
      process.env.NODE_ENV = 'production';
      expect(databaseConfig().synchronize).toBe(false);

      process.env.NODE_ENV = 'development';
      expect(databaseConfig().synchronize).toBe(true);

      process.env.NODE_ENV = 'test';
      expect(databaseConfig().synchronize).toBe(true);
    });

    it('should set logging based on environment', () => {
      process.env.NODE_ENV = 'development';
      expect(databaseConfig().logging).toBe(true);

      process.env.NODE_ENV = 'production';
      expect(databaseConfig().logging).toBe(false);

      process.env.NODE_ENV = 'test';
      expect(databaseConfig().logging).toBe(false);
    });

    it('should enable autoLoadEntities', () => {
      const config = databaseConfig();

      expect(config.autoLoadEntities).toBe(true);
    });
  });
});
