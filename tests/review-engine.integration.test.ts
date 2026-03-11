import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewEngineService } from '../src/modules/review/review-engine.service.js';
import { GitHubClientService } from '../src/modules/github/github.service.js';
import { AiExecutorService } from '../src/modules/ai/ai-executor.service.js';
import { AppConfigService } from '../src/config/app-config.service.js';
import {
  Review,
  PullRequest as PullRequestEntity,
  Comment,
  ReviewMetrics,
  RepositoryConfig,
} from '../src/database/entities/index.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs-extra';

describe('ReviewEngineService Integration', () => {
  let service: ReviewEngineService;
  let module: TestingModule;
  let githubService: any;
  let aiService: any;
  let configService: any;
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-review-engine.db');

  beforeEach(async () => {
    if (await fs.pathExists(testDbPath)) {
      await fs.remove(testDbPath);
    }
    await fs.ensureDir(path.dirname(testDbPath));

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

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: testDbPath,
          entities: [Review, PullRequestEntity, Comment, RepositoryConfig, ReviewMetrics],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Review, PullRequestEntity, Comment, RepositoryConfig, ReviewMetrics]),
      ],
      providers: [
        ReviewEngineService,
        { provide: GitHubClientService, useValue: githubService },
        { provide: AiExecutorService, useValue: aiService },
        { provide: AppConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ReviewEngineService>(ReviewEngineService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    if (await fs.pathExists(testDbPath)) {
      await fs.remove(testDbPath);
    }
  });

  it('should complete a full review cycle successfully', async () => {
    const mockPR = {
      number: 123,
      title: 'Fix bug',
      repository: { nameWithOwner: 'owner/repo' },
      url: 'https://github.com/owner/repo/pull/123',
      updatedAt: '2026-03-11T00:00:00Z',
      headRefName: 'feature',
      baseRefName: 'main',
    };

    githubService.prepareRepository.mockResolvedValue('/tmp/repo');
    githubService.execaVerbose.mockResolvedValue({ stdout: 'diff content', exitCode: 0 });
    aiService.executeReview.mockResolvedValue([
      {
        file_path: 'src/app.ts',
        line_number: 10,
        issue_type: 'quality',
        severity: 'info',
        message: 'Small improvement needed',
        is_auto_fixable: false,
      }
    ]);
    githubService.addReview.mockResolvedValue(true);
    githubService.mergePR.mockResolvedValue(true);

    const result = await service.reviewPullRequest(mockPR as any);

    expect(result).toBe(true);
    
    // Verify DB state
    const reviewRepo = module.get(DataSource).getRepository(Review);
    const reviews = await reviewRepo.find({ relations: ['pullRequest', 'metrics'] });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].metrics.healthScore).toBe(99); 
    expect(reviews[0].pullRequest.number).toBe(123);

    const commentRepo = module.get(DataSource).getRepository(Comment);
    const comments = await commentRepo.find();
    expect(comments).toHaveLength(1);
    expect(comments[0].file).toBe('src/app.ts');

    expect(githubService.addReview).toHaveBeenCalled();
  });
});
