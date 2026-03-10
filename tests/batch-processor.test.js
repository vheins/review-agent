import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { BatchProcessor } from '../src/batch-processor.js';

describe('BatchProcessor Property Tests', () => {
  const processor = new BatchProcessor();

  it('Property 13: Related PR Detection', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 5 }),
          target_branch: fc.string({ minLength: 1 })
        }),
        fc.record({
          title: fc.string({ minLength: 5 }),
          target_branch: fc.string({ minLength: 1 })
        }),
        (pr1, pr2) => {
          const related = processor.isRelated(pr1, pr2);
          
          // If same target branch, MUST be related
          if (pr1.target_branch === pr2.target_branch) {
            expect(related).toBe(true);
          }
          
          // Symmetry property
          expect(processor.isRelated(pr2, pr1)).toBe(related);
          
          return true;
        }
      )
    );
  });

  it('Should detect relationship by title overlap', () => {
    const pr1 = { title: 'Update dependencies for security', target_branch: 'main' };
    const pr2 = { title: 'Security fix for login', target_branch: 'develop' };
    
    expect(processor.isRelated(pr1, pr2)).toBe(true); // 'security' overlaps
  });
});
