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
import { GitHubClientService, PullRequest } from '../packages/backend/src/modules/github/github.service.ts';
import { execa } from 'execa';
import * as fs from 'fs-extra';
import { EventEmitter } from 'events';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

describe('GitHubClientService', () => {
  let service: GitHubClientService;
  let appConfig: any;
  let configService: any;

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

    service = new GitHubClientService(appConfig as any, configService as any);
  });

  /**
   * Helper to create a mock execa process
   */
  function createMockExecaProcess(stdoutContent: string, exitCode = 0) {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const promise = Promise.resolve({ stdout: stdoutContent, stderr: '', exitCode }) as any;
    
    promise.stdout = stdout;
    promise.stderr = stderr;
    
    // Simulate streaming data
    setTimeout(() => {
      if (stdoutContent) {
        stdout.emit('data', Buffer.from(stdoutContent));
      }
    }, 0);

    return promise;
  }

  describe('fetchOpenPRs', () => {
    it('should fetch PRs based on configured scope', async () => {
      const mockPRs = [
        {
          number: 1,
          title: 'Test PR',
          repository: { nameWithOwner: 'owner/repo' },
          url: 'https://github.com/owner/repo/pull/1',
          updatedAt: '2026-03-11T00:00:00Z',
          state: 'open',
        }
      ];

      (execa as Mock).mockImplementation((cmd, args) => {
        if (args.includes('search')) {
          return createMockExecaProcess(JSON.stringify(mockPRs));
        }
        if (args.includes('view')) {
          return createMockExecaProcess(JSON.stringify({ headRefName: 'feature', baseRefName: 'main' }));
        }
        return createMockExecaProcess('');
      });

      const prs = await service.fetchOpenPRs();

      expect(prs).toHaveLength(1);
      expect(prs[0].number).toBe(1);
      expect(prs[0].headRefName).toBe('feature');
      expect(execa).toHaveBeenCalledWith('gh', expect.arrayContaining(['search', 'prs', '--author=@me']), expect.any(Object));
      expect(execa).toHaveBeenCalledWith('gh', expect.arrayContaining(['search', 'prs', '--assignee=@me']), expect.any(Object));
      expect(execa).not.toHaveBeenCalledWith('gh', expect.arrayContaining(['search', 'prs', '--review-requested=@me']), expect.any(Object));
    });

    it('should deduplicate PRs by URL', async () => {
      const mockPRs = [
        {
          number: 1,
          title: 'Test PR',
          repository: { nameWithOwner: 'owner/repo' },
          url: 'https://github.com/owner/repo/pull/1',
          updatedAt: '2026-03-11T00:00:00Z',
          state: 'open',
        }
      ];

      (execa as Mock).mockImplementation((cmd, args) => {
        if (args.includes('search')) {
          return createMockExecaProcess(JSON.stringify(mockPRs));
        }
        return createMockExecaProcess(JSON.stringify({}));
      });

      const prs = await service.fetchOpenPRs();
      expect(prs).toHaveLength(1);
    });

    it('should exclude PRs from ignored owners', async () => {
      const mockPRs = [
        {
          number: 1,
          title: 'Ignored PR',
          repository: { nameWithOwner: 'ignored-owner/repo' },
          url: 'https://github.com/ignored-owner/repo/pull/1',
          updatedAt: '2026-03-11T00:00:00Z',
          state: 'open',
        }
      ];

      (execa as Mock).mockImplementation((cmd, args) => {
        if (args.includes('search')) {
          return createMockExecaProcess(JSON.stringify(mockPRs));
        }
        return createMockExecaProcess(JSON.stringify({}));
      });

      const prs = await service.fetchOpenPRs();
      expect(prs).toHaveLength(0);
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
      (execa as Mock).mockImplementation(() => createMockExecaProcess(''));

      const repoDir = await service.prepareRepository(mockPR);

      expect(repoDir).toContain('owner-repo');
      expect(execa).toHaveBeenCalledWith('git', expect.arrayContaining(['clone', 'git@github.com:owner/repo.git', expect.any(String)]), expect.any(Object));
      expect(execa).toHaveBeenCalledWith('git', expect.arrayContaining(['checkout', 'feature']), expect.any(Object));
    });
  });

  describe('addReview', () => {
    it('should add a review comment via gh CLI', async () => {
      (execa as Mock).mockImplementation(() => createMockExecaProcess(''));
      // No token to trigger CLI fallback
      configService.get.mockReturnValue(null);

      const result = await service.addReview('owner/repo', 1, 'Great job!', 'APPROVE');

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('gh', [
        'pr', 'review', '1',
        '--repo', 'owner/repo',
        '--body', 'Great job!',
        '--approve'
      ], expect.any(Object));
    });

    it('should return false if gh CLI fails', async () => {
      (execa as Mock).mockImplementation(() => createMockExecaProcess('', 1));
      configService.get.mockReturnValue(null);

      const result = await service.addReview('owner/repo', 1, 'message', 'COMMENT');

      expect(result).toBe(false);
    });
  });

  describe('mergePR', () => {
    it('should merge PR via gh CLI', async () => {
      (execa as Mock).mockImplementation(() => createMockExecaProcess(''));
      configService.get.mockReturnValue(null);

      const result = await service.mergePR('owner/repo', 1, 'squash');

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('gh', [
        'pr', 'merge', '1',
        '--repo', 'owner/repo',
        '--squash',
        '--delete-branch'
      ], expect.any(Object));
    });
  });

  describe('assignReviewers', () => {
    it('should assign reviewers via gh CLI', async () => {
      (execa as Mock).mockImplementation(() => createMockExecaProcess(''));
      configService.get.mockReturnValue(null);

      const result = await service.assignReviewers('owner/repo', 1, ['user1', 'user2']);

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('gh', [
        'pr', 'edit', '1',
        '--repo', 'owner/repo',
        '--add-reviewer', 'user1,user2'
      ], expect.any(Object));
    });
  });
});
