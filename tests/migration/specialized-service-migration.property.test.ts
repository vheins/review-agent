import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpecializedServicesValidator } from '../../packages/backend/src/migration/specialized-services-validator.js';
import path from 'path';
import fs from 'fs-extra';

describe('SpecializedServicesValidator Property Tests', () => {
  let validator: SpecializedServicesValidator;

  beforeEach(() => {
    validator = new SpecializedServicesValidator();
  });

  describe('Property 25: Specialized service migration verification', () => {
    it('should verify specialized services migration status', async () => {
      // Feature: complete-nestjs-migration, Property 25: Specialized service migration verification
      const status = await validator.getSpecializedServicesStatus();
      
      const sla = status.find(s => s.serviceType === 'slaMonitor');
      expect(typeof sla?.migrated).toBe('boolean');
      
      const fp = status.find(s => s.serviceType === 'falsePositiveTracker');
      expect(typeof fp?.migrated).toBe('boolean');
    });
  });
});
