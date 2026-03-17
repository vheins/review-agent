import { describe, expect, it, vi } from 'vitest';
import { CodexExecutor } from '../packages/backend/src/modules/ai/executors/others.executor.js';

describe('CodexExecutor', () => {
  it('uses exec mode with stdin prompt and bypass mode by default', async () => {
    const executor = new CodexExecutor();
    const execSpy = vi
      .spyOn(executor as any, 'execCli')
      .mockResolvedValue('ok');

    delete process.env.CODEX_YOLO;
    process.env.CODEX_MODEL = 'gpt-5-codex';

    await executor.review(
      {
        number: 12,
        title: 'Improve employee sync',
        repository: { nameWithOwner: 'idsolutions-id/human-resource-dashboard' },
        headRefName: 'feature/employee-sync',
        baseRefName: 'main',
      } as any,
      ['backend/cmd/api/main.go'],
      '/tmp/repo',
    );

    expect(execSpy).toHaveBeenCalledWith(
      'codex',
      ['exec', '-', '--cd', '/tmp/repo', '--model', 'gpt-5-codex', '--dangerously-bypass-approvals-and-sandbox'],
      {
        cwd: '/tmp/repo',
        input: expect.stringContaining('Changed File Paths:'),
      },
    );
  });

  it('enables full bypass mode when CODEX_YOLO is true', async () => {
    const executor = new CodexExecutor();
    const execSpy = vi
      .spyOn(executor as any, 'execCli')
      .mockResolvedValue('ok');

    process.env.CODEX_MODEL = 'auto';
    process.env.CODEX_YOLO = 'true';

    await executor.review(
      {
        number: 34,
        title: 'Add working story support',
        repository: { nameWithOwner: 'idsolutions-id/human-resource-dashboard' },
        headRefName: 'feature/working-story',
        baseRefName: 'main',
      } as any,
      ['backend/cmd/api/main.go'],
      '/tmp/repo',
    );

    expect(execSpy).toHaveBeenCalledWith(
      'codex',
      ['exec', '-', '--cd', '/tmp/repo', '--dangerously-bypass-approvals-and-sandbox'],
      {
        cwd: '/tmp/repo',
        input: expect.any(String),
      },
    );
  });
});
