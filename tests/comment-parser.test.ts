import { describe, it, expect, beforeEach } from 'vitest';
import { CommentParserService } from '../src/common/parser/comment-parser.service.js';

describe('CommentParserService', () => {
  let service: CommentParserService;

  beforeEach(() => {
    service = new CommentParserService();
  });

  it('should parse structured output correctly', () => {
    const output = "[File: src/app.ts] [Line: 10] [Type: security] [Severity: high] Fix this.";
    const result = service.parse(output);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      file_path: 'src/app.ts',
      line_number: 10,
      issue_type: 'security',
      severity: 'error',
      message: 'Fix this.',
      suggested_fix: undefined,
      is_auto_fixable: false,
    });
  });

  it('should extract suggested fixes', () => {
    const output = "[File: src/app.ts] [Line: 10] [Type: quality] [Severity: low] Use arrow function.\n```suggestion\nconst a = () => {};\n```";
    const result = service.parse(output);

    expect(result).toHaveLength(1);
    expect(result[0].suggested_fix).toBe('const a = () => {};');
    expect(result[0].is_auto_fixable).toBe(true);
  });

  it('should handle multiple comments', () => {
    const output = `
[File: a.ts] [Line: 1] [Type: style] [Severity: info] Msg 1
[File: b.ts] [Line: 2] [Type: logic] [Severity: critical] Msg 2
    `.trim();
    const result = service.parse(output);

    expect(result).toHaveLength(2);
    expect(result[0].file_path).toBe('a.ts');
    expect(result[1].file_path).toBe('b.ts');
  });

  it('should fallback to unstructured format', () => {
    const output = "1. src/main.js:5 - Error here";
    const result = service.parse(output);

    expect(result).toHaveLength(1);
    expect(result[0].file_path).toBe('src/main.js');
    expect(result[0].line_number).toBe(5);
    expect(result[0].message).toBe('Error here');
  });
});
