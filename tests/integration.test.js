import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ciIntegration } from '../src/ci-integration.js';
import { coverageTracker } from '../src/coverage-tracker.js';
import { webhookHandler } from '../src/webhook-handler.js';
import crypto from 'crypto';

describe('Technical Integration Services', () => {
  describe('CIIntegration', () => {
    it('Should parse LCOV content correctly', async () => {
      const lcov = 'SF:app.js\nDA:1,1\nDA:2,0\nLF:2\nLH:1\nend_of_record';
      const coverage = await ciIntegration.parseLcov(lcov);
      expect(coverage).toBe(50);
    });
  });

  describe('CoverageTracker', () => {
    it('Should calculate coverage delta', () => {
      const result = coverageTracker.calculateDelta(80, 75);
      expect(result.delta).toBe(-5);
      expect(result.isDecrease).toBe(true);

      const result2 = coverageTracker.calculateDelta(80, 85);
      expect(result2.isDecrease).toBe(false);
    });
  });

  describe('WebhookHandler', () => {
    it('Should verify signatures', () => {
      const handler = new webhookHandler.constructor('secret');
      const payload = JSON.stringify({ action: 'opened' });
      const hmac = crypto.createHmac('sha256', 'secret');
      const signature = 'sha256=' + hmac.update(payload).digest('hex');
      
      expect(handler.verifySignature(payload, signature)).toBe(true);
      expect(handler.verifySignature(payload, 'wrong')).toBe(false);
    });
  });
});
