import { vi } from 'vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubClientService } from '../packages/backend/src/modules/github/github.service.js';

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
    staleInvolvesReviewDays: 3,
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

    service = new GitHubClientService(configService as any, appConfig as any, githubApi as any, githubCli as any);
  });

  describe('fetchOpenPRs', () => {
    it('should fetch PRs via CLI search first', async () => {
      githubCli.searchPRs.mockResolvedValue([
        {
          id: 'pr-1',
          number: 1,
          title: 'Test PR',
          body: '',
          state: 'open',
          url: 'https://github.com/owner/repo/pull/1',
          updatedAt: '2026-03-11T00:00:00Z',
          createdAt: '2026-03-10T00:00:00Z',
          repository: { nameWithOwner: 'owner/repo' },
          author: { login: 'user' },
          labels: [],
        }
      ]);

      const prs = await service.fetchOpenPRs();

      expect(prs).toHaveLength(1);
      expect(githubCli.searchPRs).toHaveBeenCalled();
      expect(githubApi.searchPRs).not.toHaveBeenCalled();
    });

    it('should fallback to CLI if API fails', async () => {
      githubApi.searchPRs.mockRejectedValue(new Error('API Error'));
      githubCli.searchPRs.mockResolvedValue([]);

      await service.fetchOpenPRs();

      expect(githubCli.searchPRs).toHaveBeenCalled();
    });

    it('should deduplicate PRs by URL', async () => {
      appConfig.getAppConfig.mockReturnValue({
        ...mockAppConfig,
        prScope: ['authored', 'assigned'],
      });
      githubCli.searchPRs
        .mockResolvedValueOnce([
          {
            id: 'pr-1',
            number: 1,
            title: 'Test PR',
            body: '',
            state: 'open',
            url: 'https://github.com/owner/repo/pull/1',
            updatedAt: '2026-03-11T00:00:00Z',
            createdAt: '2026-03-10T00:00:00Z',
            repository: { nameWithOwner: 'owner/repo' },
            author: { login: 'user' },
            labels: [],
          }
        ])
        .mockResolvedValueOnce([
          {
            id: 'pr-1',
            number: 1,
            title: 'Test PR',
            body: '',
            state: 'open',
            url: 'https://github.com/owner/repo/pull/1',
            updatedAt: '2026-03-11T00:00:00Z',
            createdAt: '2026-03-10T00:00:00Z',
            repository: { nameWithOwner: 'owner/repo' },
            author: { login: 'user' },
            labels: [],
          }
        ]);

      const prs = await service.fetchOpenPRs();
      expect(prs).toHaveLength(1);
    });

    it('should merge matched scopes across duplicate PR discovery results', async () => {
      appConfig.getAppConfig.mockReturnValue({
        ...mockAppConfig,
        prScope: ['assigned', 'involves'],
      });
      configService.get.mockImplementation((key: string) => {
        if (key === 'GITHUB_TOKEN') return undefined;
        if (key === 'GITHUB_USERNAME') return 'reviewer';
        return undefined;
      });
      githubCli.searchPRs
        .mockResolvedValueOnce([
          {
            id: 'pr-1',
            number: 10,
            title: 'Shared PR',
            body: '',
            state: 'open',
            url: 'https://github.com/owner/repo/pull/10',
            author: { login: 'user' },
            labels: [],
            createdAt: '2026-03-01T00:00:00Z',
            updatedAt: '2026-03-02T00:00:00Z',
            repository: { nameWithOwner: 'owner/repo' },
          }
        ])
        .mockResolvedValueOnce([
          {
            id: 'pr-1',
            number: 10,
            title: 'Shared PR',
            body: '',
            state: 'open',
            url: 'https://github.com/owner/repo/pull/10',
            author: { login: 'user' },
            labels: [],
            createdAt: '2026-03-01T00:00:00Z',
            updatedAt: '2026-03-02T00:00:00Z',
            repository: { nameWithOwner: 'owner/repo' },
          }
        ]);

      const prs = await service.fetchOpenPRs();

      expect(prs).toHaveLength(1);
      expect(prs[0].matchedScopes).toEqual(['assigned', 'involves']);
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

      const result = await service.mergePR('owner/repo', 1, 'merge');

      expect(result).toBe(true);
      expect(githubApi.mergePR).toHaveBeenCalledWith('owner/repo', 1, 'merge');
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
