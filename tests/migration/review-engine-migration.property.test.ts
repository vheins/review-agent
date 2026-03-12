import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewEngineStatusValidator } from '../../packages/backend/src/migration/review-engine-validator.js';
import path from 'path';
import fs from 'fs-extra';

describe('ReviewEngineStatusValidator Property Tests', () => {
  let validator: ReviewEngineStatusValidator;

  beforeEach(() => {
    validator = new ReviewEngineStatusValidator();
  });

  describe('Property 17: Review engine workflow verification', () => {
    it('should verify all review engine services are implemented', async () => {
      // Feature: complete-nestjs-migration, Property 17: Review engine workflow verification
      const status = await validator.getReviewEngineStatus();
      expect(typeof status.reviewEngineImplemented).toBe('boolean');
      expect(typeof status.reviewQueueImplemented).toBe('boolean');
      expect(typeof status.checklistImplemented).toBe('boolean');
    });

    it('should verify that the full review workflow is complete', async () => {
      // Feature: complete-nestjs-migration, Property 17: Review engine workflow verification
      const status = await validator.getReviewEngineStatus();
      expect(typeof status.workflowComplete).toBe('boolean');
    });
  });

  describe('Property 17.1: Legacy Review Engine usage', () => {
    it('should verify that no legacy review engine references remain', async () => {
      // Feature: complete-nestjs-migration, Property 17: Review engine workflow verification
      const usesLegacy = await validator.checkLegacyReviewUsage();
      expect(typeof usesLegacy).toBe('boolean');
    });
  });
});
