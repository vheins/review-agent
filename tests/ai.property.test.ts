import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiExecutorService } from '../src/modules/ai/ai-executor.service.js';
import { CommentParserService } from '../src/common/parser/comment-parser.service.js';
import * as fc from 'fast-check';

describe('AiExecutorService Property Tests', () => {
  let service: AiExecutorService;
  let configService: any;
  let parserService: CommentParserService;

  beforeEach(() => {
    configService = {};
    parserService = new CommentParserService();
    service = new AiExecutorService(configService as any, parserService);
  });

  describe('Property 15: AI Output Parsing', () => {
    it('should correctly parse valid structured output regardless of content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            file: fc.string({ minLength: 1 }),
            line: fc.integer({ min: 1, max: 10000 }),
            type: fc.constantFrom('security', 'quality', 'style', 'logic'),
            severity: fc.constantFrom('critical', 'high', 'medium', 'low', 'warn', 'error', 'info'),
            message: fc.string({ minLength: 1 }),
          }),
          async ({ file, line, type, severity, message }) => {
            // Avoid characters that might break the regex if they appear in wrong places
            const cleanFile = file.replace(/[\[\]]/g, '').trim();
            const cleanMessage = message.replace(/[\[\]]/g, '').trim();
            
            if (cleanFile.length === 0 || cleanMessage.length === 0) return;

            const output = `[File: ${cleanFile}] [Line: ${line}] [Type: ${type}] [Severity: ${severity}] ${cleanMessage}`;
            const comments = service.parseOutput(output);

            expect(comments).toHaveLength(1);
            expect(comments[0].file_path).toBe(cleanFile);
            expect(comments[0].line_number).toBe(line);
            expect(comments[0].issue_type).toBe(type);
            expect(comments[0].message).toContain(cleanMessage);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle multiple concatenated structured outputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              file: fc.string({ minLength: 1, maxLength: 20 }),
              line: fc.integer({ min: 1, max: 1000 }),
              message: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (items) => {
            // Clean items
            const cleanItems = items.map(item => ({
              file: item.file.replace(/[\[\]\n]/g, '').trim(),
              line: item.line,
              message: item.message.replace(/[\[\]\n]/g, '').trim()
            })).filter(item => item.file.length > 0 && item.message.length > 0);

            if (cleanItems.length === 0) return;

            const output = cleanItems
              .map(item => `[File: ${item.file}] [Line: ${item.line}] [Type: quality] [Severity: low] ${item.message}`)
              .join('\n');
            
            const comments = service.parseOutput(output);
            expect(comments).toHaveLength(cleanItems.length);
            
            cleanItems.forEach((item, index) => {
              expect(comments[index].file_path).toBe(item.file);
              expect(comments[index].line_number).toBe(item.line);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
