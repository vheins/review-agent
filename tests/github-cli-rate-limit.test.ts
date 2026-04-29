import { PassThrough } from 'stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.fn();

vi.mock('execa', () => ({
  execa: execaMock,
}));

const { GithubCliService } = await import('../packages/backend/src/modules/github/services/github-cli.service.js');

function subprocess(result: any) {
  const proc = Promise.resolve(result) as any;
  proc.stdout = new PassThrough();
  return proc;
}

describe('GithubCliService rate limit waiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T03:35:32.000Z'));
  });

  it('waits until the GraphQL rate limit reset time and retries the gh command', async () => {
    const resetSeconds = Math.floor((Date.now() + 10_000) / 1000);
    execaMock
      .mockReturnValueOnce(subprocess({
        exitCode: 1,
        stdout: '',
        stderr: 'GraphQL: API rate limit already exceeded for user ID 20860294.',
        all: 'GraphQL: API rate limit already exceeded for user ID 20860294.',
      }))
      .mockReturnValueOnce(subprocess({
        exitCode: 0,
        stdout: JSON.stringify({ resources: { graphql: { reset: resetSeconds } } }),
        stderr: '',
      }))
      .mockReturnValueOnce(subprocess({
        exitCode: 0,
        stdout: '{"state":"OPEN"}',
        stderr: '',
      }));

    const service = new GithubCliService();
    const pending = service.execaVerbose('gh', ['pr', 'view', '1', '--repo', 'owner/repo']);

    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({
      stdout: '{"state":"OPEN"}',
      exitCode: 0,
    });
    expect(execaMock).toHaveBeenCalledTimes(3);
    expect(execaMock.mock.calls[1]?.[0]).toBe('gh');
    expect(execaMock.mock.calls[1]?.[1]).toEqual(['api', 'rate_limit']);
    expect(execaMock.mock.calls[2]?.[1]).toEqual(['pr', 'view', '1', '--repo', 'owner/repo']);
  });
});
