import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { RejectionCategorizer } from '../src/rejection-categorizer.js';

describe('RejectionCategorizer Property Tests', () => {
  const categorizer = new RejectionCategorizer();

  it('Property 5: Comment Categorization Completeness', () => {
    // A comment must be assigned exactly one category
    fc.assert(
      fc.property(
        fc.record({
          issue_type: fc.string({ maxLength: 20 }),
          message: fc.string({ maxLength: 50 }),
          severity: fc.constantFrom('critical', 'high', 'warning', 'info')
        }),
        (comment) => {
          const category = categorizer.categorizeComment(comment);
          
          const validCategories = ['security', 'quality', 'testing', 'documentation', 'other'];
          expect(validCategories).toContain(category);
          
          return true;
        }
      )
    );
  });

  it('Should categorize specific keywords correctly', () => {
    expect(categorizer.categorizeComment({ message: 'SQL injection vulnerability found' })).toBe('security');
    expect(categorizer.categorizeComment({ issue_type: 'complexity', message: 'Code is too complex' })).toBe('quality');
    expect(categorizer.categorizeComment({ message: 'Missing unit tests' })).toBe('testing');
    expect(categorizer.categorizeComment({ message: 'Please add doc comments' })).toBe('documentation');
    expect(categorizer.categorizeComment({ message: 'Random text without keywords' })).toBe('other');
  });

  it('Should extract reasons from multiple comments', () => {
    const comments = [
      { message: 'SQL injection', severity: 'high' },
      { message: 'Missing tests', severity: 'warning' },
      { message: 'Typo in variable', severity: 'info' } // Should be ignored due to severity if info is ignored
    ];
    
    const reasons = categorizer.categorizeReview(comments);
    expect(reasons).toContain('security');
    expect(reasons).toContain('testing');
    expect(reasons).not.toContain('other'); // info severity is excluded in `categorizeReview`
  });
});
