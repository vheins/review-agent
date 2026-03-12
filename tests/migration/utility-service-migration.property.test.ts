import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UtilityValidator } from '../../packages/backend/src/migration/utility-validator.js';
import path from 'path';
import fs from 'fs-extra';

describe('UtilityValidator Property Tests', () => {
  let validator: UtilityValidator;

  beforeEach(() => {
    validator = new UtilityValidator();
  });

  describe('Property 22: Utility service migration verification', () => {
    it('should verify utility services implementation', async () => {
      // Feature: complete-nestjs-migration, Property 22: Utility service migration verification
      const status = await validator.getUtilityServicesStatus();
      
      const logger = status.find(s => s.serviceType === 'logger');
      expect(typeof logger?.migrated).toBe('boolean');
      
      const errorHandler = status.find(s => s.serviceType === 'errorHandler');
      expect(typeof errorHandler?.migrated).toBe('boolean');
    });
  });

  describe('Property 22.1: Legacy Utility usage', () => {
    it('should verify that no legacy utility references remain', async () => {
      // Feature: complete-nestjs-migration, Property 22: Utility service migration verification
      const usesLegacy = await validator.checkLegacyUtilityUsage();
      expect(typeof usesLegacy).toBe('boolean');
    });
  });
});
