import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CoverageTracker } from '../src/coverage-tracker.js';

describe('CoverageTracker Property Tests', () => {
  const tracker = new CoverageTracker();

  it('Property 19: Coverage Delta Calculation', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }), // base coverage
        fc.float({ min: 0, max: 100, noNaN: true }), // pr coverage
        (base, pr) => {
          const result = tracker.calculateDelta(base, pr);
          
          expect(result.base).toBe(base);
          expect(result.current).toBe(pr);
          expect(result.delta).toBeCloseTo(pr - base, 5);
          
          if (pr < base - 0.01) {
            expect(result.isDecrease).toBe(true);
          } else {
            // Note: if it's exactly base - 0.01, it depends on implementation
            // but for > base - 0.01 it should be false
            if (pr > base) {
              expect(result.isDecrease).toBe(false);
            }
          }
          
          return true;
        }
      )
    );
  });
});
