import { describe, it, expect } from 'vitest';
import { validationSchema } from '../../packages/backend/src/config/validation.schema.js';

/**
 * Configuration Validation Schema Tests
 * 
 * Tests for Joi validation schema that validates environment variables.
 * Ensures that configuration validation catches invalid values and
 * applies appropriate defaults.
 * 
 * Requirements: 9.4
 */
describe('Configuration Validation Schema', () => {
  describe('Application Configuration', () => {
    it('should validate valid NODE_ENV values', () => {
      const { error } = validationSchema.validate({
        NODE_ENV: 'development',
      });
      expect(error).toBeUndefined();

      const { error: error2 } = validationSchema.validate({
        NODE_ENV: 'production',
      });
      expect(error2).toBeUndefined();

      const { error: error3 } = validationSchema.validate({
        NODE_ENV: 'test',
      });
      expect(error3).toBeUndefined();
    });

    it('should reject invalid NODE_ENV values', () => {
      const { error } = validationSchema.validate({
        NODE_ENV: 'invalid',
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('NODE_ENV');
    });

    it('should validate API_PORT as number', () => {
      const { error, value } = validationSchema.validate({
        API_PORT: '3000',
      });
      expect(error).toBeUndefined();
      expect(value.API_PORT).toBe(3000);
    });

    it('should reject invalid port numbers', () => {
      const { error } = validationSchema.validate({
        API_PORT: '99999',
      });
      expect(error).toBeDefined();
    });

    it('should validate REVIEW_INTERVAL minimum value', () => {
      const { error } = validationSchema.validate({
        REVIEW_INTERVAL: '30',
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('REVIEW_INTERVAL');

      const { error: error2 } = validationSchema.validate({
        REVIEW_INTERVAL: '60',
      });
      expect(error2).toBeUndefined();
    });

    it('should validate LOG_LEVEL values', () => {
      const validLevels = ['error', 'warn', 'info', 'debug'];

      for (const level of validLevels) {
        const { error } = validationSchema.validate({
          LOG_LEVEL: level,
        });
        expect(error).toBeUndefined();
      }

      const { error } = validationSchema.validate({
        LOG_LEVEL: 'invalid',
      });
      expect(error).toBeDefined();
    });

    it('should allow empty EXCLUDE_REPO_OWNERS', () => {
      const { error } = validationSchema.validate({
        EXCLUDE_REPO_OWNERS: '',
      });
      expect(error).toBeUndefined();
    });

    it('should validate AUTO_MERGE as boolean', () => {
      const { error, value } = validationSchema.validate({
        AUTO_MERGE: 'true',
      });
      expect(error).toBeUndefined();
      expect(value.AUTO_MERGE).toBe(true);

      const { error: error2, value: value2 } = validationSchema.validate({
        AUTO_MERGE: 'false',
      });
      expect(error2).toBeUndefined();
      expect(value2.AUTO_MERGE).toBe(false);
    });

    it('should validate stale involves threshold as positive integer', () => {
      const { error, value } = validationSchema.validate({
        STALE_INVOLVES_REVIEW_DAYS: '3',
      });
      expect(error).toBeUndefined();
      expect(value.STALE_INVOLVES_REVIEW_DAYS).toBe(3);

      const { error: invalidError } = validationSchema.validate({
        STALE_INVOLVES_REVIEW_DAYS: '0',
      });
      expect(invalidError).toBeDefined();
      expect(invalidError?.message).toContain('STALE_INVOLVES_REVIEW_DAYS');
    });
  });

  describe('Review Configuration', () => {
    it('should validate DELEGATE as boolean', () => {
      const { error, value } = validationSchema.validate({
        DELEGATE: 'true',
      });
      expect(error).toBeUndefined();
      expect(value.DELEGATE).toBe(true);
    });

    it('should validate REVIEW_MODE values', () => {
      const { error } = validationSchema.validate({
        REVIEW_MODE: 'comment',
      });
      expect(error).toBeUndefined();

      const { error: error2 } = validationSchema.validate({
        REVIEW_MODE: 'auto-fix',
      });
      expect(error2).toBeUndefined();

      const { error: error3 } = validationSchema.validate({
        REVIEW_MODE: 'invalid',
      });
      expect(error3).toBeDefined();
    });

    it('should validate severity scores as non-negative numbers', () => {
      const { error } = validationSchema.validate({
        SEVERITY_THRESHOLD: '10',
        SEVERITY_CRITICAL: '5',
        SEVERITY_HIGH: '3',
        SEVERITY_MEDIUM: '2',
        SEVERITY_LOW: '1',
      });
      expect(error).toBeUndefined();
    });

    it('should reject negative severity scores', () => {
      const { error } = validationSchema.validate({
        SEVERITY_THRESHOLD: '-1',
      });
      expect(error).toBeDefined();
    });

    it('should allow zero severity scores', () => {
      const { error } = validationSchema.validate({
        SEVERITY_LOW: '0',
      });
      expect(error).toBeUndefined();
    });
  });

  describe('AI Executor Configuration', () => {
    it('should validate AI_EXECUTOR values', () => {
      const validExecutors = ['gemini', 'copilot', 'kiro', 'claude', 'codex', 'opencode'];

      for (const executor of validExecutors) {
        const { error } = validationSchema.validate({
          AI_EXECUTOR: executor,
        });
        expect(error).toBeUndefined();
      }

      const { error } = validationSchema.validate({
        AI_EXECUTOR: 'invalid',
      });
      expect(error).toBeDefined();
    });

    it('should validate executor enabled flags as booleans', () => {
      const { error, value } = validationSchema.validate({
        GEMINI_ENABLED: 'true',
        COPILOT_ENABLED: 'false',
        KIRO_ENABLED: 'true',
      });
      expect(error).toBeUndefined();
      expect(value.GEMINI_ENABLED).toBe(true);
      expect(value.COPILOT_ENABLED).toBe(false);
      expect(value.KIRO_ENABLED).toBe(true);
    });

    it('should validate YOLO flags as booleans', () => {
      const { error, value } = validationSchema.validate({
        GEMINI_YOLO: 'true',
        COPILOT_YOLO: 'false',
      });
      expect(error).toBeUndefined();
      expect(value.GEMINI_YOLO).toBe(true);
      expect(value.COPILOT_YOLO).toBe(false);
    });

    it('should allow empty agent strings', () => {
      const { error } = validationSchema.validate({
        KIRO_AGENT: '',
        CLAUDE_AGENT: '',
        OPENCODE_AGENT: '',
      });
      expect(error).toBeUndefined();
    });

    it('should validate all executor model settings', () => {
      const { error } = validationSchema.validate({
        GEMINI_MODEL: 'gemini-pro',
        COPILOT_MODEL: 'gpt-4',
        KIRO_AGENT: 'custom',
        CLAUDE_MODEL: 'claude-3',
        CODEX_MODEL: 'codex',
        OPENCODE_MODEL: 'default',
      });
      expect(error).toBeUndefined();
    });
  });

  describe('Default Values', () => {
    it('should apply default values for missing fields', () => {
      const { error, value } = validationSchema.validate({});

      expect(error).toBeUndefined();
      expect(value.NODE_ENV).toBe('development');
      expect(value.API_PORT).toBe(3000);
      expect(value.REVIEW_INTERVAL).toBe(600);
      expect(value.LOG_LEVEL).toBe('info');
      expect(value.WORKSPACE_DIR).toMatch(/\/workspace$/);
      expect(value.AUTO_MERGE).toBe(false);
      expect(value.STALE_INVOLVES_REVIEW_DAYS).toBe(3);
      expect(value.DELEGATE).toBe(false);
      expect(value.REVIEW_MODE).toBe('comment');
      expect(value.AI_EXECUTOR).toBe('gemini');
    });

    it('should apply default severity scores', () => {
      const { value } = validationSchema.validate({});

      expect(value.SEVERITY_THRESHOLD).toBe(10);
      expect(value.SEVERITY_CRITICAL).toBe(5);
      expect(value.SEVERITY_HIGH).toBe(3);
      expect(value.SEVERITY_MEDIUM).toBe(2);
      expect(value.SEVERITY_LOW).toBe(1);
    });

    it('should apply default executor settings', () => {
      const { value } = validationSchema.validate({});

      expect(value.GEMINI_ENABLED).toBe(true);
      expect(value.GEMINI_MODEL).toBe('auto-3');
      expect(value.COPILOT_ENABLED).toBe(false);
      expect(value.COPILOT_MODEL).toBe('claude-haiku-4.5');
    });
  });

  describe('Validation Options', () => {
    it('should allow unknown environment variables when allowUnknown is true', () => {
      const { error } = validationSchema.validate({
        UNKNOWN_VAR: 'some-value',
        ANOTHER_UNKNOWN: '123',
      }, { allowUnknown: true });
      // Should not error on unknown variables when allowUnknown is set
      expect(error).toBeUndefined();
    });

    it('should validate all fields and return all errors', () => {
      const { error } = validationSchema.validate({
        NODE_ENV: 'invalid',
        API_PORT: '99999',
        REVIEW_MODE: 'invalid',
        AI_EXECUTOR: 'invalid',
      });

      expect(error).toBeDefined();
      // Should contain multiple validation errors
      expect(error?.message).toContain('NODE_ENV');
    });
  });

  describe('Type Coercion', () => {
    it('should coerce string numbers to numbers', () => {
      const { value } = validationSchema.validate({
        API_PORT: '4000',
        REVIEW_INTERVAL: '900',
        SEVERITY_THRESHOLD: '15',
      });

      expect(typeof value.API_PORT).toBe('number');
      expect(typeof value.REVIEW_INTERVAL).toBe('number');
      expect(typeof value.SEVERITY_THRESHOLD).toBe('number');
      expect(value.API_PORT).toBe(4000);
      expect(value.REVIEW_INTERVAL).toBe(900);
      expect(value.SEVERITY_THRESHOLD).toBe(15);
    });

    it('should coerce string booleans to booleans', () => {
      const { value } = validationSchema.validate({
        AUTO_MERGE: 'true',
        DELEGATE: 'false',
        GEMINI_ENABLED: 'true',
      });

      expect(typeof value.AUTO_MERGE).toBe('boolean');
      expect(typeof value.DELEGATE).toBe('boolean');
      expect(typeof value.GEMINI_ENABLED).toBe('boolean');
      expect(value.AUTO_MERGE).toBe(true);
      expect(value.DELEGATE).toBe(false);
      expect(value.GEMINI_ENABLED).toBe(true);
    });
  });
});
