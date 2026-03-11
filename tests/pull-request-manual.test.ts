import 'reflect-metadata';
import { PullRequestService } from '../src/modules/pull-request/pull-request.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PullRequestService Manual', () => {
  let service: PullRequestService;
  let prRepo: any;
  let githubService: any;
  let reviewEngine: any;

  beforeEach(() => {
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

    service = new PullRequestService(prRepo, githubService, reviewEngine);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
