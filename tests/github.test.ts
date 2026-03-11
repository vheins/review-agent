import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GitHubClientService, PullRequest } from '../src/modules/github/github.service.js';
import { execa } from 'execa';
import * as fs from 'fs-extra';
import { EventEmitter } from 'events';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

// Mock fs-extra
vi.mock('fs-extra', async () => {
  const actual = await vi.importActual('fs-extra');
  return {
    ...actual as any,
    pathExists: vi.fn(),
  };
});

describe('GitHubClientService', () => {
  let service: GitHubClientService;
  let configService: any;

  const mockAppConfig = {
    prScope: ['authored', 'assigned'],
    excludeRepoOwners: ['ignored-owner'],
    workspaceDir: './test-workspace',
    autoMerge: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    configService = {
      getAppConfig: vi.fn().mockReturnValue(mockAppConfig),
    };

    service = new GitHubClientService(configService as any);
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
      headRefName: 'feature',
      baseRefName: 'main',
    };

    it('should clone repository if it does not exist', async () => {
      (fs.pathExists as Mock).mockResolvedValue(false);
      (execa as Mock).mockImplementation(() => createMockExecaProcess(''));

      const repoDir = await service.prepareRepository(mockPR);

      expect(repoDir).toContain('owner-repo');
      expect(execa).toHaveBeenCalledWith('git', expect.arrayContaining(['clone', 'git@github.com:owner/repo.git', expect.any(String)]), expect.any(Object));
      expect(execa).toHaveBeenCalledWith('git', expect.arrayContaining(['checkout', 'feature']), expect.any(Object));
    });

    it('should fetch and reset if repository exists', async () => {
      (fs.pathExists as Mock).mockResolvedValue(true);
      (execa as Mock).mockImplementation(() => createMockExecaProcess(''));

      const repoDir = await service.prepareRepository(mockPR);

      expect(execa).toHaveBeenCalledWith('git', ['fetch', 'origin'], expect.any(Object));
      expect(execa).toHaveBeenCalledWith('git', ['checkout', 'feature'], expect.any(Object));
      expect(execa).toHaveBeenCalledWith('git', ['reset', '--hard', 'origin/feature'], expect.any(Object));
      expect(execa).toHaveBeenCalledWith('git', ['clean', '-fd'], expect.any(Object));
    });
  });

  describe('addReview', () => {
    it('should add a review comment via gh CLI', async () => {
      (execa as Mock).mockImplementation(() => createMockExecaProcess(''));

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

      const result = await service.addReview('owner/repo', 1, 'message', 'COMMENT');

      expect(result).toBe(false);
    });
  });

  describe('mergePR', () => {
    it('should merge PR via gh CLI', async () => {
      (execa as Mock).mockImplementation(() => createMockExecaProcess(''));

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
