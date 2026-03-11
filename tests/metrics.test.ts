import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsService } from '../src/modules/metrics/metrics.service.js';

describe('MetricsService', () => {
  let service: MetricsService;
  let metricsRepo: any;
  let reviewRepo: any;
  let prRepo: any;
  let commentRepo: any;
  let devMetricsRepo: any;

  beforeEach(() => {
    metricsRepo = {};
    reviewRepo = {};
    prRepo = {};
    commentRepo = {};
    devMetricsRepo = {};
    service = new MetricsService(metricsRepo, reviewRepo, prRepo, commentRepo, devMetricsRepo);
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score based on accuracy, thoroughness, and helpfulness', () => {
      const comments = [
        { category: 'security', severity: 'error', message: 'msg', suggestion: 'fix' }
      ] as any;
      const score = service.calculateQualityScore(comments, 0);
      // (100 * 0.5) + ((20+5) * 0.3) + (100 * 0.2) = 50 + 7.5 + 20 = 77.5 -> 78
      expect(score).toBe(78);
    });

    it('should penalize false positives', () => {
      const comments = [
        { category: 'security', severity: 'error', message: 'msg', suggestion: 'fix' },
        { category: 'security', severity: 'error', message: 'msg', suggestion: 'fix' }
      ] as any;
      const scoreWithFP = service.calculateQualityScore(comments, 1);
      const scoreWithoutFP = service.calculateQualityScore(comments, 0);
      expect(scoreWithFP).toBeLessThan(scoreWithoutFP);
    });
  });

  describe('calculateHealthScore', () => {
    it('should return 100 for clean PR', () => {
      const score = service.calculateHealthScore([], []);
      expect(score).toBe(100);
    });

    it('should penalize security findings', () => {
      const findings = [{ severity: 'critical' }];
      const score = service.calculateHealthScore(findings, []);
      // (70 * 0.6) + (100 * 0.4) = 42 + 40 = 82
      expect(score).toBe(82);
    });

    it('should penalize review errors', () => {
      const comments = [{ severity: 'error' }] as any;
      const score = service.calculateHealthScore([], comments);
      // (100 * 0.6) + (90 * 0.4) = 60 + 36 = 96
      expect(score).toBe(96);
    });
  });
});
