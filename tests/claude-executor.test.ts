import { describe, expect, it, vi } from 'vitest';
import { ClaudeExecutor } from '../packages/backend/src/modules/ai/executors/others.executor.js';

describe('ClaudeExecutor', () => {
  it('uses prompt file, repo access, and yolo permissions by default', async () => {
    const executor = new ClaudeExecutor();
    const execSpy = vi
      .spyOn(executor as any, 'execCliWithPromptFile')
      .mockResolvedValue('ok');

    delete process.env.CLAUDE_AGENT;
    delete process.env.CLAUDE_YOLO;
    process.env.CLAUDE_MODEL = 'sonnet';

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
      'claude',
      [
        '--print',
        '--model',
        'sonnet',
        '--output-format',
        'text',
        '--add-dir',
        '/tmp/repo',
        '--permission-mode',
        'bypassPermissions',
        '-p',
        '__PROMPT_FILE__',
        '--dangerously-skip-permissions',
      ],
      expect.stringContaining('Changed File Paths:'),
      { cwd: '/tmp/repo' },
    );
  });

  it('enables configured agent and yolo permissions when requested', async () => {
    const executor = new ClaudeExecutor();
    const execSpy = vi
      .spyOn(executor as any, 'execCliWithPromptFile')
      .mockResolvedValue('ok');

    process.env.CLAUDE_MODEL = 'opus';
    process.env.CLAUDE_AGENT = 'reviewer';
    process.env.CLAUDE_YOLO = 'true';

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
      'claude',
      [
        '--print',
        '--model',
        'opus',
        '--output-format',
        'text',
        '--add-dir',
        '/tmp/repo',
        '--permission-mode',
        'bypassPermissions',
        '-p',
        '__PROMPT_FILE__',
        '--agent',
        'reviewer',
        '--dangerously-skip-permissions',
      ],
      expect.any(String),
      { cwd: '/tmp/repo' },
    );
  });
});
