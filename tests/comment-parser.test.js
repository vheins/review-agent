import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CommentParser } from '../src/comment-parser.js';

describe('CommentParser Property Tests', () => {
  const parser = new CommentParser();

  it('Property 21: Comment Parsing Completeness for structured format', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          file: fc.stringMatching(/^[a-zA-Z0-9._\/\- ]+$/).map(s => s.trim()).filter(s => s.length > 0),
          line: fc.integer({ min: 1, max: 10000 }),
          type: fc.constantFrom('security', 'quality', 'style', 'logic'),
          severity: fc.constantFrom('critical', 'high', 'medium', 'low', 'error', 'warning', 'info'),
          message: fc.stringMatching(/^[a-zA-Z0-9._\/\- \!\?\(\)\,\.]+$/).map(s => s.trim()).filter(s => s.length >= 5)
        }), { minLength: 1, maxLength: 20 }),
        (comments) => {
          // Generate structured string
          const output = comments.map(c => 
            `[File: ${c.file}] [Line: ${c.line}] [Type: ${c.type}] [Severity: ${c.severity}] ${c.message}`
          ).join('\n\n');

          const parsed = parser.parse(output);
          
          expect(parsed.length).toBe(comments.length);
          for (let i = 0; i < comments.length; i++) {
            expect(parsed[i].file_path).toBe(comments[i].file);
            expect(parsed[i].line_number).toBe(comments[i].line);
            expect(parsed[i].issue_type).toBe(comments[i].type);
            expect(parsed[i].message).toContain(comments[i].message);
          }
        }
      )
    );
  });

  it('Should parse suggested fixes', () => {
    const output = `[File: src/app.js] [Line: 10] [Type: logic] [Severity: high] Fix this.
\`\`\`suggestion
const x = 1;
\`\`\``;
    const parsed = parser.parse(output);
    expect(parsed[0].suggested_fix).toBe('const x = 1;');
    expect(parsed[0].is_auto_fixable).toBe(true);
  });

  it('Should handle unstructured formats as fallback', () => {
    const output = `1. src/index.js:45 - Fix this bug\n2. tests/app.js:12 - Missing test case`;
    const parsed = parser.parse(output);
    expect(parsed.length).toBe(2);
    expect(parsed[0].file_path).toBe('src/index.js');
    expect(parsed[0].line_number).toBe(45);
    expect(parsed[0].message).toBe('Fix this bug');
  });
});
