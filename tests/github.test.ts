import { vi } from 'vitest';

// Mock fs-extra BEFORE other imports
vi.mock('fs-extra', () => {
  const mock = {
    pathExists: vi.fn().mockResolvedValue(false),
    stat: vi.fn().mockResolvedValue({ isFile: () => true }),
    readFile: vi.fn().mockResolvedValue(''),
    remove: vi.fn().mockResolvedValue(undefined),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    pathExistsSync: vi.fn().mockReturnValue(false),
  };
  return {
    ...mock,
    default: mock,
    __esModule: true,
  };
});

import { describe, it, expect, beforeEach, Mock } from 'vitest';
import { GitHubClientService, PullRequest } from '../packages/backend/src/modules/github/github.service.js';
import * as fs from 'fs-extra';

describe('GitHubClientService', () => {
  let service: GitHubClientService;
  let appConfig: any;
  let configService: any;
  let githubApi: any;
  let githubCli: any;

  const mockAppConfig = {
    prScope: ['authored', 'assigned'],
    excludeRepoOwners: ['ignored-owner'],
    workspaceDir: './test-workspace',
    autoMerge: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    appConfig = {
      getAppConfig: vi.fn().mockReturnValue(mockAppConfig),
    };

    configService = {
      get: vi.fn().mockReturnValue('mock-token'),
    };

    githubApi = {
      searchPRs: vi.fn(),
      getPRDetail: vi.fn(),
      addReview: vi.fn(),
      mergePR: vi.fn(),
      assignReviewers: vi.fn(),
      searchIssues: vi.fn(),
    };

    githubCli = {
      searchPRs: vi.fn().mockResolvedValue([]),
      getPRDetail: vi.fn().mockResolvedValue({}),
      addReview: vi.fn().mockResolvedValue(undefined),
      mergePR: vi.fn().mockResolvedValue(undefined),
      assignReviewers: vi.fn().mockResolvedValue(undefined),
      searchIssues: vi.fn().mockResolvedValue([]),
      execaVerbose: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    };

    service = new GitHubClientService(appConfig as any, configService as any, githubApi as any, githubCli as any);
  });

  describe('fetchOpenPRs', () => {
    it('should fetch PRs via API if token is available', async () => {
      const mockPRs = {
        items: [
          {
            number: 1,
            title: 'Test PR',
            repository_url: 'https://api.github.com/repos/owner/repo',
            html_url: 'https://github.com/owner/repo/pull/1',
            updated_at: '2026-03-11T00:00:00Z',
            state: 'open',
            user: { login: 'user' }
          }
        ]
      };

      githubApi.searchPRs.mockResolvedValue(mockPRs);
      githubApi.getPRDetail.mockResolvedValue({ head: { ref: 'feature' }, base: { ref: 'main' } });

      const prs = await service.fetchOpenPRs();

      expect(prs).toHaveLength(1);
      expect(githubApi.searchPRs).toHaveBeenCalled();
      expect(githubCli.searchPRs).not.toHaveBeenCalled();
    });

    it('should fallback to CLI if API fails', async () => {
      githubApi.searchPRs.mockRejectedValue(new Error('API Error'));
      githubCli.searchPRs.mockResolvedValue([]);

      await service.fetchOpenPRs();

      expect(githubCli.searchPRs).toHaveBeenCalled();
    });

    it('should deduplicate PRs by URL', async () => {
      const mockPRs = {
        items: [
          {
            number: 1,
            title: 'Test PR',
            repository_url: 'https://api.github.com/repos/owner/repo',
            html_url: 'https://github.com/owner/repo/pull/1',
            updated_at: '2026-03-11T00:00:00Z',
            state: 'open',
            user: { login: 'user' }
          }
        ]
      };

      githubApi.searchPRs.mockResolvedValue(mockPRs);
      githubApi.getPRDetail.mockResolvedValue({ head: { ref: 'feature' }, base: { ref: 'main' } });

      const prs = await service.fetchOpenPRs();
      expect(prs).toHaveLength(1);
    });
  });

  describe('prepareRepository', () => {
    const mockPR: PullRequest = {
      number: 1,
      title: 'Test PR',
      repository: { nameWithOwner: 'owner/repo' },
      url: 'https://github.com/owner/repo/pull/1',
      updatedAt: '2026-03-11T00:00:00Z',
      state: 'open',
      headRefName: 'feature',
      baseRefName: 'main',
      author: { login: 'user' }
    };

    it('should clone repository if it does not exist', async () => {
      (fs.pathExists as Mock).mockResolvedValue(false);

      const repoDir = await service.prepareRepository(mockPR);

      expect(repoDir).toContain('owner-repo');
      expect(githubCli.execaVerbose).toHaveBeenCalledWith('git', expect.arrayContaining(['clone', 'git@github.com:owner/repo.git', expect.any(String)]));
    });
  });

  describe('addReview', () => {
    it('should add review via API if token is available', async () => {
      githubApi.addReview.mockResolvedValue({});

      const result = await service.addReview('owner/repo', 1, 'Great job!', 'APPROVE');

      expect(result).toBe(true);
      expect(githubApi.addReview).toHaveBeenCalledWith('owner/repo', 1, 'Great job!', 'APPROVE');
    });

    it('should fallback to CLI if API fails', async () => {
      configService.get.mockReturnValue('mock-token');
      githubApi.addReview.mockRejectedValue(new Error('API Error'));
      githubCli.addReview.mockResolvedValue(undefined);

      const result = await service.addReview('owner/repo', 1, 'message', 'COMMENT');

      expect(result).toBe(true);
      expect(githubCli.addReview).toHaveBeenCalled();
    });
  });

  describe('mergePR', () => {
    it('should merge PR via API', async () => {
      githubApi.mergePR.mockResolvedValue({});

      const result = await service.mergePR('owner/repo', 1, 'squash');

      expect(result).toBe(true);
      expect(githubApi.mergePR).toHaveBeenCalledWith('owner/repo', 1, 'squash');
    });
  });

  describe('assignReviewers', () => {
    it('should assign reviewers via API', async () => {
      githubApi.assignReviewers.mockResolvedValue({});

      const result = await service.assignReviewers('owner/repo', 1, ['user1']);

      expect(result).toBe(true);
      expect(githubApi.assignReviewers).toHaveBeenCalledWith('owner/repo', 1, ['user1']);
    });
  });
});
