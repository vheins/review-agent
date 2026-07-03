import { describe, expect, it, vi } from 'vitest';
import { KiroExecutor, OpenCodeExecutor } from '../packages/backend/src/modules/ai/executors/others.executor.js';

describe('KiroExecutor', () => {
  it('uses stdin in chat mode from the repository directory', async () => {
    const executor = new KiroExecutor();
    const execSpy = vi
      .spyOn(executor as any, 'execCli')
      .mockResolvedValue('ok');

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
  it('runs against the repository directory and forwards configured agent/model', async () => {
    const executor = new OpenCodeExecutor();
    const execSpy = vi
      .spyOn(executor as any, 'execCli')
      .mockResolvedValue('ok');

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
        '--dangerously-skip-permissions',
        '--model',
        'openai/gpt-5',
        '--agent',
        'reviewer',
        expect.stringContaining('Pull Request: #11 Update employee milestones'),
      ],
      { cwd: '/tmp/repo', allowFail: true },
    );
  });
});
