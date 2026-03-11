import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiExecutorService } from '../src/modules/ai/ai-executor.service.js';
import { CommentParserService } from '../src/common/parser/comment-parser.service.js';
import { PullRequest } from '../src/modules/github/github.service.js';

describe('AiExecutorService', () => {
  let service: AiExecutorService;
  let configService: any;
  let parserService: CommentParserService;

  beforeEach(() => {
    vi.clearAllMocks();

    configService = {
      getRepositoryConfig: vi.fn(),
    };

    parserService = new CommentParserService();
    service = new AiExecutorService(configService as any, parserService);
  });

  describe('Executor Selection', () => {
    const mockPR: PullRequest = {
      number: 1,
      title: 'Test PR',
      repository: { nameWithOwner: 'owner/repo' },
      url: 'https://github.com/owner/repo/pull/1',
      updatedAt: '2026-03-11T00:00:00Z',
    };

    it('should select preferred executor from config', async () => {
      configService.getRepositoryConfig.mockResolvedValue({
        executor: 'copilot',
      });

      // Internal method selection test via executeReview call
      // We can check logs or behavior
      await service.executeReview(mockPR, 'diff', '/tmp');
      
      // Verification via log output or by inspecting private state if needed
      // But since we simulated output, we can check the result format
      const comments = await service.executeReview(mockPR, 'diff', '/tmp');
      expect(comments[0].message).toContain('Missing semicolon'); // Copilot specific simulation
    });

    it('should fallback to gemini if preferred executor not found', async () => {
      configService.getRepositoryConfig.mockResolvedValue({
        executor: 'unknown-ai',
      });

      const comments = await service.executeReview(mockPR, 'diff', '/tmp');
      expect(comments[0].message).toContain('Code could be more concise'); // Gemini specific simulation
    });

    it('should support all specified executors', async () => {
      const executors = ['gemini', 'copilot', 'kiro', 'claude', 'codex', 'opencode'];
      
      for (const executor of executors) {
        configService.getRepositoryConfig.mockResolvedValue({ executor });
        const comments = await service.executeReview(mockPR, 'diff', '/tmp');
        expect(comments.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Output Parsing', () => {
    it('should parse structured AI output correctly', () => {
      const output = "[File: src/test.js] [Line: 20] [Type: security] [Severity: high] Fix this injection.\n```suggestion\nfixed code\n```";
      const comments = service.parseOutput(output);

      expect(comments).toHaveLength(1);
      expect(comments[0]).toEqual({
        file_path: 'src/test.js',
        line_number: 20,
        issue_type: 'security',
        severity: 'error',
        message: 'Fix this injection.',
        suggested_fix: 'fixed code',
        is_auto_fixable: true
      });
    });

    it('should handle multiple comments in one output', () => {
      const output = `
[File: src/a.js] [Line: 1] [Type: style] [Severity: low] Style issue.
[File: src/b.js] [Line: 2] [Type: quality] [Severity: medium] Quality issue.
      `.trim();
      const comments = service.parseOutput(output);

      expect(comments).toHaveLength(2);
      expect(comments[0].file_path).toBe('src/a.js');
      expect(comments[1].file_path).toBe('src/b.js');
    });

    it('should fallback to unstructured parsing', () => {
      const output = "1. src/index.ts:10 - Fix this error";
      const comments = service.parseOutput(output);

      expect(comments).toHaveLength(1);
      expect(comments[0].file_path).toBe('src/index.ts');
      expect(comments[0].line_number).toBe(10);
      expect(comments[0].message).toBe('Fix this error');
    });
  });
});
