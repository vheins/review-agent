import 'reflect-metadata';
import { ReviewEngineService } from '../src/modules/review/review-engine.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

describe('ReviewEngineService Simplified', () => {
  let service: ReviewEngineService;
  let githubService: any;
  let aiService: any;
  let configService: any;
  let dataSource: any;
  let reviewRepo: any;
  let prRepo: any;
  let commentRepo: any;
  let metricsRepo: any;

  beforeEach(() => {
    githubService = {
      prepareRepository: vi.fn(),
      execaVerbose: vi.fn(),
      addReview: vi.fn(),
      mergePR: vi.fn(),
      fetchOpenPRs: vi.fn(),
    };

    aiService = {
      executeReview: vi.fn(),
    };

    configService = {
      getAppConfig: vi.fn().mockReturnValue({
        severityThreshold: 50,
        autoMerge: true,
      }),
      getRepositoryConfig: vi.fn().mockResolvedValue({
        executor: 'gemini',
      }),
    };

    dataSource = {
      createQueryRunner: vi.fn().mockReturnValue({
        connect: vi.fn(),
        startTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          save: vi.fn().mockImplementation(val => Promise.resolve(val)),
        },
      }),
    };

    reviewRepo = {
      create: vi.fn().mockImplementation(val => ({ id: 'review-id', ...val })),
      findOne: vi.fn(),
    };

    prRepo = {
      create: vi.fn().mockImplementation(val => val),
      findOne: vi.fn(),
    };

    commentRepo = {
      create: vi.fn().mockImplementation(val => val),
    };

    metricsRepo = {
      create: vi.fn().mockImplementation(val => val),
    };

    service = new ReviewEngineService(
      githubService,
      aiService,
      configService,
      dataSource,
      reviewRepo,
      prRepo,
      commentRepo,
      metricsRepo
    );
  });

  it('should complete a review cycle with mocked dependencies', async () => {
    const mockPR = {
      number: 123,
      title: 'Fix bug',
      repository: { nameWithOwner: 'owner/repo' },
      url: 'https://github.com/owner/repo/pull/123',
      headRefName: 'feature',
      baseRefName: 'main',
    };

    githubService.prepareRepository.mockResolvedValue('/tmp/repo');
    githubService.execaVerbose.mockResolvedValue({ stdout: 'diff', exitCode: 0 });
    aiService.executeReview.mockResolvedValue([
      {
        file_path: 'src/app.ts',
        line_number: 10,
        issue_type: 'quality',
        severity: 'info',
        message: 'msg',
        is_auto_fixable: false,
      }
    ]);
    githubService.addReview.mockResolvedValue(true);

    const result = await service.reviewPullRequest(mockPR as any);

    expect(result).toBe(true);
    expect(githubService.prepareRepository).toHaveBeenCalled();
    expect(aiService.executeReview).toHaveBeenCalled();
    expect(githubService.addReview).toHaveBeenCalled();
  });

  describe('Property Tests: Completion Actions', () => {
    it('should always attempt to post a review regardless of comment count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              file_path: fc.string(),
              line_number: fc.integer(),
              issue_type: fc.constantFrom('security', 'quality', 'style', 'logic', 'general' as const),
              severity: fc.constantFrom('error', 'warning', 'info' as const),
              message: fc.string(),
              is_auto_fixable: fc.boolean(),
            })
          ),
          async (comments) => {
            vi.clearAllMocks();
            githubService.prepareRepository.mockResolvedValue('/tmp/repo');
            githubService.execaVerbose.mockResolvedValue({ stdout: 'diff', exitCode: 0 });
            aiService.executeReview.mockResolvedValue(comments);
            githubService.addReview.mockResolvedValue(true);

            const mockPR = {
              number: 1,
              title: 'PR',
              repository: { nameWithOwner: 'owner/repo' },
              url: 'url',
            };

            await service.reviewPullRequest(mockPR as any);
            expect(githubService.addReview).toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should correctly calculate severity score and decision', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 5 }), // critical
          fc.integer({ min: 0, max: 5 }), // high
          async (criticalCount, highCount) => {
            const comments: any[] = [];
            for (let i = 0; i < criticalCount; i++) comments.push({ severity: 'error', message: 'CRITICAL', issue_type: 'security' });
            for (let i = 0; i < highCount; i++) comments.push({ severity: 'error', message: 'HIGH', issue_type: 'security' });

            vi.clearAllMocks();
            githubService.prepareRepository.mockResolvedValue('/tmp/repo');
            githubService.execaVerbose.mockResolvedValue({ stdout: 'diff', exitCode: 0 });
            aiService.executeReview.mockResolvedValue(comments);
            
            const mockPR = { number: 1, title: 'PR', repository: { nameWithOwner: 'owner/repo' } };
            await service.reviewPullRequest(mockPR as any);

            // If there are any errors, decision should be REQUEST_CHANGES
            if (criticalCount + highCount > 0) {
              expect(githubService.addReview).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.any(String), 'REQUEST_CHANGES');
            } else {
              expect(githubService.addReview).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.any(String), 'APPROVE');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
