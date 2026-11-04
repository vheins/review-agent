import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KiroExecutor,
  OpenCodeExecutor,
} from '../packages/backend/src/modules/ai/executors/others.executor.js';

describe('KiroExecutor', () => {
  it('uses stdin in chat mode from the repository directory', async () => {
    const executor = new KiroExecutor();
    const execSpy = vi.spyOn(executor as any, 'execCli').mockResolvedValue('ok');

    delete process.env.KIRO_AGENT;

    await executor.review(
      {
        number: 10,
        title: 'Update employee milestones',
        repository: { nameWithOwner: 'idsolutions-id/human-resource-dashboard' },
        headRefName: 'feature/milestones',
        baseRefName: 'main',
      } as any,
      ['backend/cmd/api/main.go'],
      '/tmp/repo',
    );

    expect(execSpy).toHaveBeenCalledWith(
      'kiro-cli',
      ['chat', '--no-interactive', '--trust-all-tools'],
      {
        cwd: '/tmp/repo',
        input: expect.stringContaining('Pull Request: #10 Update employee milestones'),
      },
    );
  });
});

describe('OpenCodeExecutor', () => {
  afterEach(() => {
    delete process.env.OPENCODE_VERSION;
    delete process.env.OPENCODE_MODEL;
    delete process.env.OPENCODE_AGENT;
    delete process.env.OPENCODE_VARIANT;
  });

  it('builds v1 args (--dir/--variant/--dangerously-skip-permissions) when OPENCODE_VERSION=v1', async () => {
    const executor = new OpenCodeExecutor();
    const execSpy = vi.spyOn(executor as any, 'execCli').mockResolvedValue('ok');

    process.env.OPENCODE_VERSION = 'v1';
    process.env.OPENCODE_MODEL = 'openai/gpt-5';
    process.env.OPENCODE_AGENT = 'reviewer';

    await executor.review(
      {
        number: 11,
        title: 'Update employee milestones',
        repository: { nameWithOwner: 'idsolutions-id/human-resource-dashboard' },
        headRefName: 'feature/milestones',
        baseRefName: 'main',
      } as any,
      ['backend/cmd/api/main.go'],
      '/tmp/repo',
    );

    expect(execSpy).toHaveBeenCalledWith(
      'opencode',
      [
        'run',
        '--dir',
        '/tmp/repo',
        '--thinking',
        '--dangerously-skip-permissions',
        '--variant',
        'max',
        '--model',
        'openai/gpt-5',
        '--agent',
        'reviewer',
        expect.stringContaining('Pull Request: #11 Update employee milestones'),
      ],
      { cwd: '/tmp/repo' },
    );
  });

  it('builds v2 args (cwd-based/--auto/model#variant) when OPENCODE_VERSION=v2', async () => {
    const executor = new OpenCodeExecutor();
    const execSpy = vi.spyOn(executor as any, 'execCli').mockResolvedValue('ok');

    process.env.OPENCODE_VERSION = 'v2';
    process.env.OPENCODE_MODEL = 'openai/gpt-5';
    process.env.OPENCODE_AGENT = 'reviewer';

    await executor.review(
      {
        number: 11,
        title: 'Update employee milestones',
        repository: { nameWithOwner: 'idsolutions-id/human-resource-dashboard' },
        headRefName: 'feature/milestones',
        baseRefName: 'main',
      } as any,
      ['backend/cmd/api/main.go'],
      '/tmp/repo',
    );

    expect(execSpy).toHaveBeenCalledWith(
      'opencode',
      [
        'run',
        '--thinking',
        '--auto',
        '--model',
        'openai/gpt-5#max',
        '--agent',
        'reviewer',
        expect.stringContaining('Pull Request: #11 Update employee milestones'),
      ],
      { cwd: '/tmp/repo' },
    );
  });

  it('auto-detects v2 from the installed binary version output', async () => {
    const executor = new OpenCodeExecutor();
    const execSpy = vi
      .spyOn(executor as any, 'execCli')
      .mockImplementation(async (_cmd: string, args: string[]) =>
        args[0] === '--version' ? 'opencode v2.0.20' : 'ok',
      );

    delete process.env.OPENCODE_VERSION;
    process.env.OPENCODE_BIN = 'opencode-auto-detect-test';
    process.env.OPENCODE_MODEL = 'auto';
    process.env.OPENCODE_AGENT = '';

    await executor.review(
      {
        number: 11,
        title: 'Update employee milestones',
        repository: { nameWithOwner: 'idsolutions-id/human-resource-dashboard' },
        headRefName: 'feature/milestones',
        baseRefName: 'main',
      } as any,
      ['backend/cmd/api/main.go'],
      '/tmp/repo',
    );

    expect(execSpy).toHaveBeenCalledWith('opencode-auto-detect-test', ['--version'], {
      allowFail: true,
    });
    const runCall = execSpy.mock.calls.find(c => c[1]?.[0] === 'run');
    expect(runCall?.[0]).toBe('opencode-auto-detect-test');
    expect(runCall?.[1]).toContain('--auto');
    expect(runCall?.[1]).not.toContain('--dir');
    expect(runCall?.[2]).toEqual({ cwd: '/tmp/repo' });

    delete process.env.OPENCODE_BIN;
  });
});
