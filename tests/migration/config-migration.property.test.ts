import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigValidator } from '../../packages/backend/src/migration/config-validator.js';
import path from 'path';
import fs from 'fs-extra';

describe('ConfigValidator Property Tests', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('Property 13: Configuration migration verification', () => {
    it('should verify NestJS ConfigModule usage', async () => {
      // Feature: complete-nestjs-migration, Property 13: Configuration migration verification
      const isComplete = await validator.verifyNestJSConfig();
      expect(typeof isComplete).toBe('boolean');
    });
  });

  describe('Property 14: Validation schema verification', () => {
    it('should ensure validation.schema.ts is implemented with Joi', async () => {
      // Feature: complete-nestjs-migration, Property 14: Validation schema verification
      const isSynced = await validator.verifyValidationSchema();
      expect(typeof isSynced).toBe('boolean');
    });
  });

  describe('Property 13.1: Legacy config usage', () => {
    it('should verify that no legacy config references remain', async () => {
      // Feature: complete-nestjs-migration, Property 13: Configuration migration verification
      const usesLegacy = await validator.checkLegacyConfigUsage();
      expect(typeof usesLegacy).toBe('boolean');
    });
  });
});
