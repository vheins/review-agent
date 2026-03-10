import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HealthScoreCalculator } from '../src/health-score-calculator.js';

describe('HealthScoreCalculator Property Tests', () => {
  const calculator = new HealthScoreCalculator();

  it('Property 18: Health Score Bounds and Consistency', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ severity: fc.constantFrom('critical', 'high', 'medium', 'low') }), { maxLength: 20 }), // security findings
        fc.array(fc.record({ severity: fc.constantFrom('error', 'warning', 'info') }), { maxLength: 50 }), // review comments
        fc.oneof(
          fc.constant(null),
          fc.record({ status: fc.constantFrom('passed', 'failed'), test_results: fc.string() })
        ),
        (findings, comments, testRun) => {
          const scores = calculator.calculateScores(findings, comments, testRun);
          
          expect(scores.finalScore).toBeGreaterThanOrEqual(0);
          expect(scores.finalScore).toBeLessThanOrEqual(100);
          
          expect(scores.securityScore).toBeGreaterThanOrEqual(0);
          expect(scores.reviewScore).toBeGreaterThanOrEqual(0);
          expect(scores.testScore).toBeGreaterThanOrEqual(0);
          
          return true;
        }
      )
    );
  });
});
