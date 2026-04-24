import 'reflect-metadata';
import { ReviewEngineService } from '../packages/backend/src/modules/review/review-engine.service.js';
import { AutoFixService } from '../packages/backend/src/modules/review/services/auto-fix.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

describe('ReviewEngineService Simplified', () => {
  let service: ReviewEngineService;
  let githubService: any;
  let repoManager: any;
  let aiService: any;
  let aiFix: any;
  let gateway: any;
  let configService: any;
  let dataSource: any;
  let securityScanner: any;
  let dependencyScanner: any;
  let checklistService: any;
  let auditLogger: any;
  let gamification: any;
  let metricsService: any;
  
  let reviewRepo: any;
  let prRepo: any;
  let commentRepo: any;
  let metricsRepo: any;

  beforeEach(() => {
    githubService = {
      prepareRepository: vi.fn(),
      getPRDetail: vi.fn(),
      execaVerbose: vi.fn(),
      addReview: vi.fn(),
      mergePR: vi.fn(),
      fetchOpenPRs: vi.fn(),
      getChangedFiles: vi.fn().mockResolvedValue([{ path: 'src/app.ts', content: 'code' }]),
      listReviews: vi.fn().mockResolvedValue([]),
    };

    aiService = {
      executeReview: vi.fn(),
      executeRaw: vi.fn().mockResolvedValue('Summary'),
      parseOutput: vi.fn().mockReturnValue([]),
    };

    aiFix = {
      generateComplexFix: vi.fn(),
      validateFix: vi.fn(),
    };

    gateway = {
      broadcastReviewStarted: vi.fn(),
      broadcastReviewProgress: vi.fn(),
      broadcastReviewCompleted: vi.fn(),
      broadcastReviewFailed: vi.fn(),
      broadcastMetricsUpdate: vi.fn(),
    };

    configService = {
      getAppConfig: vi.fn().mockReturnValue({
        severityThreshold: 50,
        autoMerge: true,
        reviewMode: 'comment',
      }),
      getRepositoryConfig: vi.fn().mockResolvedValue({
        executor: 'gemini',
        reviewMode: 'comment',
        autoMerge: true,
      }),
      getReviewConfig: vi.fn().mockReturnValue({
        reviewMode: 'comment',
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

    securityScanner = {
      scanFiles: vi.fn().mockResolvedValue([]),
    };
    dependencyScanner = {
      scanDependencies: vi.fn().mockResolvedValue([]),
    };
    checklistService = {
      attachChecklistsToReview: vi.fn(),
    };
    auditLogger = {
      logAction: vi.fn(),
    };
    gamification = {
      awardPoints: vi.fn(),
    };
    metricsService = {
      calculateHealthScore: vi.fn().mockReturnValue(100),
      calculateQualityScore: vi.fn().mockReturnValue(100),
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

    repoManager = {
      prepareRepository: vi.fn().mockResolvedValue('/tmp/repo'),
    };

    const autoFixServiceInstance = {
      isFixable: vi.fn().mockReturnValue(false),
      applyFixes: vi.fn(),
      runProjectFixers: vi.fn(),
      verifyFixes: vi.fn(),
      commitAndPushFixes: vi.fn(),
      fixConflicts: vi.fn(),
    };

    service = new ReviewEngineService(
      githubService,
      repoManager as any,
      aiService,
      aiFix,
      autoFixServiceInstance as any,
      gateway,
      configService,
      dataSource,
      securityScanner,
      dependencyScanner,
      checklistService,
      auditLogger,
      gamification,
      metricsService,
      reviewRepo,
      prRepo,
      commentRepo,
      metricsRepo
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should complete a review cycle with mocked dependencies', async () => {
    const mockPR = {
      number: 123,
      title: 'Fix bug',
      repository: { nameWithOwner: 'owner/repo' },
      url: 'https://github.com/owner/repo/pull/123',
      headRefName: 'feature',
      baseRefName: 'main',
      headSha: '1234567',
      baseSha: '0987654',
      mergeable_state: 'clean',
    };

    githubService.prepareRepository.mockResolvedValue('/tmp/repo');
    githubService.execaVerbose.mockResolvedValue({ stdout: 'diff', exitCode: 0 });
    aiService.executeReview.mockResolvedValue([]);
    githubService.addReview.mockResolvedValue(true);

    const result = await service.reviewPullRequest(mockPR as any);

    expect(result).toBe(true);
    expect(repoManager.prepareRepository).toHaveBeenCalled();
    expect(aiService.executeRaw).toHaveBeenCalled();
    expect(githubService.addReview).not.toHaveBeenCalled();
    expect(githubService.mergePR).not.toHaveBeenCalled();
    expect(securityScanner.scanFiles).toHaveBeenCalled();
    expect(dependencyScanner.scanDependencies).toHaveBeenCalled();
    expect(checklistService.attachChecklistsToReview).toHaveBeenCalled();
    expect(auditLogger.logAction).toHaveBeenCalled();
  });
});
