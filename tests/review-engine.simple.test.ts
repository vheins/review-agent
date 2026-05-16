import 'reflect-metadata';
import { ReviewEngineService } from '../packages/backend/src/modules/review/review-engine.service.js';
import { AutoFixService } from '../packages/backend/src/modules/review/services/auto-fix.service.js';
import { DocumentationReviewService } from '../packages/backend/src/modules/review/services/documentation-review.service.js';
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
  let documentationReview: any;
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
      listReviewComments: vi.fn().mockResolvedValue([]),
      getPRChecks: vi.fn().mockResolvedValue([]),
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
        staleInvolvesReviewDays: 3,
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
    documentationReview = {
      analyzeChangedFiles: vi.fn().mockResolvedValue([]),
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
      documentationReview as DocumentationReviewService,
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

  it('merges an approved PR when the agent leaves it open', async () => {
    const mockPR = {
      number: 124,
      title: 'Ship feature',
      repository: { nameWithOwner: 'owner/repo' },
      url: 'https://github.com/owner/repo/pull/124',
      headRefName: 'feature',
      baseRefName: 'main',
      headSha: 'abcdef123456',
      baseSha: '0987654',
      mergeable_state: 'clean',
      state: 'open',
    };

    aiService.executeRaw.mockResolvedValue('DECISION: APPROVE\nSEVERITY_SCORE: 0\nMESSAGE:\nTidak ada blocker.');
    githubService.getPRDetail.mockResolvedValue({
      ...mockPR,
      merged: false,
      mergeable: true,
      mergeable_state: 'clean',
      state: 'open',
      headSha: 'abcdef123456',
    });
    githubService.listReviews.mockResolvedValue([
      { state: 'APPROVED', commit_id: 'abcdef123456' },
    ]);
    githubService.listReviewComments.mockResolvedValue([]);
    githubService.getPRChecks.mockResolvedValue([
      { name: 'build', status: 'completed', conclusion: 'success' },
    ]);
    githubService.mergePR.mockResolvedValue(true);

    const result = await service.reviewPullRequest(mockPR as any);

    expect(result).toBe(true);
    expect(githubService.mergePR).toHaveBeenCalledWith('owner/repo', 124, 'merge');
  });

  it('forces stale involves PRs into direct-fix mode', async () => {
    const staleDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const mockPR = {
      number: 125,
      title: 'Unblock stale PR',
      repository: { nameWithOwner: 'owner/repo' },
      url: 'https://github.com/owner/repo/pull/125',
      updatedAt: staleDate,
      headRefName: 'feature',
      baseRefName: 'main',
      headSha: 'stale123',
      baseSha: 'base123',
      mergeable_state: 'clean',
      state: 'open',
      draft: false,
      matchedScopes: ['involves'],
    };

    const result = await service.reviewPullRequest(mockPR as any);

    expect(result).toBe(true);
    expect(reviewRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'auto-fix',
    }));
    expect(aiService.executeRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        takeoverMode: 'direct-fix',
      }),
      expect.any(Array),
      '/tmp/repo'
    );
  });

  it('skips unchanged PRs from local review state without GitHub status calls', async () => {
    const updatedAt = new Date('2026-04-27T00:00:00Z');
    githubService.fetchOpenPRs.mockResolvedValue([
      {
        number: 123,
        title: 'Fix bug',
        repository: { nameWithOwner: 'owner/repo' },
        url: 'https://github.com/owner/repo/pull/123',
        updatedAt: updatedAt.toISOString(),
        state: 'open',
        draft: false,
      },
    ]);
    prRepo.findOne.mockResolvedValue({
      number: 123,
      repository: 'owner/repo',
      head_sha: 'abc123',
      updatedAt,
      mergeable_state: 'clean',
    });
    reviewRepo.findOne.mockResolvedValue({
      status: 'completed',
      completedAt: new Date('2026-04-27T00:01:00Z'),
    });
    configService.getRepositoryConfig.mockResolvedValue({
      executor: 'gemini',
      reviewMode: 'comment',
      autoMerge: false,
    });

    await service.runAll();

    expect(githubService.listReviews).not.toHaveBeenCalled();
    expect(githubService.getPRDetail).not.toHaveBeenCalled();
    expect(repoManager.prepareRepository).not.toHaveBeenCalled();
  });

  it('prioritizes stale involves PRs and does not skip same-head changes-requested takeover candidates', async () => {
    const staleDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const freshDate = new Date().toISOString();
    const stalePr = {
      number: 200,
      title: 'Stale takeover',
      repository: { nameWithOwner: 'owner/repo' },
      url: 'https://github.com/owner/repo/pull/200',
      updatedAt: staleDate,
      state: 'open',
      draft: false,
      matchedScopes: ['involves'],
      headSha: 'same-head',
    };
    const freshPr = {
      number: 100,
      title: 'Fresh PR',
      repository: { nameWithOwner: 'owner/repo' },
      url: 'https://github.com/owner/repo/pull/100',
      updatedAt: freshDate,
      state: 'open',
      draft: false,
      matchedScopes: ['assigned'],
      headSha: 'fresh-head',
    };

    githubService.fetchOpenPRs.mockResolvedValue([freshPr, stalePr]);
    prRepo.findOne.mockResolvedValue({
      number: 200,
      repository: 'owner/repo',
      head_sha: 'same-head',
      updatedAt: new Date(staleDate),
      mergeable_state: 'clean',
    });
    reviewRepo.findOne
      .mockResolvedValueOnce({
        completedAt: new Date(staleDate),
      })
      .mockResolvedValueOnce(null);
    githubService.listReviews.mockResolvedValue([
      { state: 'CHANGES_REQUESTED', commit_id: 'same-head' },
    ]);

    const reviewSpy = vi.spyOn(service, 'reviewPullRequest').mockResolvedValue(true);

    await service.runOnce();

    expect(reviewSpy).toHaveBeenCalledWith(expect.objectContaining({ number: 200 }));
  });
});
