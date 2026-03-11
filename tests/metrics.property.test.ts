import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsService } from '../src/modules/metrics/metrics.service.js';
import * as fc from 'fast-check';

describe('MetricsService Property Tests', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService({} as any, {} as any, {} as any, {} as any, {} as any);
  });

  describe('Property: Health Score Consistency', () => {
    it('should always return a score between 0 and 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            severity: fc.constantFrom('critical', 'high', 'medium', 'low')
          })),
          fc.array(fc.record({
            severity: fc.constantFrom('error', 'warning', 'info')
          })),
          async (findings, comments) => {
            const score = service.calculateHealthScore(findings, comments as any);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be monotonic: more issues = lower or equal score', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            severity: fc.constantFrom('critical', 'high', 'medium', 'low')
          })),
          fc.record({
            severity: fc.constantFrom('critical', 'high', 'medium', 'low')
          }),
          async (findings, newFinding) => {
            const scoreBefore = service.calculateHealthScore(findings, []);
            const scoreAfter = service.calculateHealthScore([...findings, newFinding], []);
            expect(scoreAfter).toBeLessThanOrEqual(scoreBefore);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
