import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import { RepositoryManagerService } from '../packages/backend/src/modules/github/services/repository-manager.service.js';

vi.mock('fs-extra', () => {
  const mock = {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    pathExists: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
  };

  return {
    ...mock,
    default: mock,
    __esModule: true,
  };
});

describe('RepositoryManagerService', () => {
  let service: RepositoryManagerService;
  let github: { execaVerbose: ReturnType<typeof vi.fn> };
  let config: { getAppConfig: ReturnType<typeof vi.fn> };
  let repoRepository: Record<string, never>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
    vi.mocked(fs.pathExists).mockResolvedValue(false);
    vi.mocked(fs.remove).mockResolvedValue(undefined);

    github = {
      execaVerbose: vi.fn(),
    };

    config = {
      getAppConfig: vi.fn().mockReturnValue({
        workspaceDir: '/tmp/review-agent-workspace',
      }),
    };

    repoRepository = {};

    service = new RepositoryManagerService(github as any, config as any, repoRepository as any);
  });

  it('fetches the PR head ref into FETCH_HEAD when checkout fails after clone', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(false);

    github.execaVerbose
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // clone
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // merge abort
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // am abort
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // rebase abort
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // reset hard
      .mockRejectedValueOnce(new Error("error: pathspec 'feature/demo' did not match any file(s) known to git")) // checkout
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // fetch pull
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }); // checkout -B

    const repoDir = await service.prepareRepository('owner/repo', 'feature/demo', 'main', 99);

    expect(repoDir).toBe('/tmp/review-agent-workspace/owner-repo');
    expect(github.execaVerbose).toHaveBeenCalledWith(
      'git',
      ['clone', 'git@github.com:owner/repo.git', '/tmp/review-agent-workspace/owner-repo'],
    );
    expect(github.execaVerbose).toHaveBeenCalledWith(
      'git',
      ['merge', '--abort'],
      { cwd: '/tmp/review-agent-workspace/owner-repo', allowFail: true },
    );
    expect(github.execaVerbose).toHaveBeenCalledWith(
      'git',
      ['checkout', 'feature/demo'],
      { cwd: '/tmp/review-agent-workspace/owner-repo' },
    );
    expect(github.execaVerbose).toHaveBeenCalledWith(
      'git',
      ['fetch', 'origin', 'pull/99/head'],
      { cwd: '/tmp/review-agent-workspace/owner-repo' },
    );
    expect(github.execaVerbose).toHaveBeenCalledWith(
      'git',
      ['checkout', '-B', 'feature/demo', 'FETCH_HEAD'],
      { cwd: '/tmp/review-agent-workspace/owner-repo' },
    );
  });
});
