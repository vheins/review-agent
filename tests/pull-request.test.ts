import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PullRequestService } from '../src/modules/pull-request/pull-request.service.js';
import { PullRequest as PullRequestEntity } from '../src/database/entities/pull-request.entity.js';
import { GitHubClientService } from '../src/modules/github/github.service.js';
import { ReviewEngineService } from '../src/modules/review/review-engine.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PullRequestService', () => {
  let service: PullRequestService;
  let prRepo: any;
  let githubService: any;
  let reviewEngine: any;

  beforeEach(async () => {
    prRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
    };
    githubService = {
      fetchOpenPRs: vi.fn(),
    };
    reviewEngine = {
      reviewPullRequest: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PullRequestService,
        { provide: getRepositoryToken(PullRequestEntity), useValue: prRepo },
        { provide: GitHubClientService, useValue: githubService },
        { provide: ReviewEngineService, useValue: reviewEngine },
      ],
    }).compile();

    service = module.get<PullRequestService>(PullRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll should return PRs from repo', async () => {
    const mockPRs = [{ id: 1, title: 'Test PR' }];
    prRepo.find.mockResolvedValue(mockPRs);

    const result = await service.findAll();
    expect(result).toEqual(mockPRs);
    expect(prRepo.find).toHaveBeenCalled();
  });

  it('triggerReview should call reviewEngine', async () => {
    const mockPR = { number: 123, repository: { nameWithOwner: 'owner/repo' } };
    githubService.fetchOpenPRs.mockResolvedValue([mockPR]);
    reviewEngine.reviewPullRequest.mockResolvedValue(true);

    const result = await service.triggerReview('owner/repo', 123);
    expect(result).toBe(true);
    expect(reviewEngine.reviewPullRequest).toHaveBeenCalledWith(mockPR);
  });
});
