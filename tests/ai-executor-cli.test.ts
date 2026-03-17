import { PassThrough } from 'stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.fn();

vi.mock('execa', () => ({
  execa: execaMock,
}));

class TestExecutor extends (await import('../packages/backend/src/modules/ai/executors/index.js')).BaseAiExecutor {
  constructor() {
    super('test');
  }

  async review(): Promise<string> {
    return '';
  }

  run(cmd: string, args: string[], options?: { cwd?: string; input?: string }) {
    return this.execCli(cmd, args, options);
  }
}

describe('BaseAiExecutor execCli', () => {
  const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs agent CLI without timeout, forwards cwd, and streams stdout/stderr', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    const subprocess = Promise.resolve({ stdout: 'final output' }) as Promise<{ stdout: string }> & {
      stdout: PassThrough;
      stderr: PassThrough;
    };
    subprocess.stdout = stdout;
    subprocess.stderr = stderr;

    execaMock.mockReturnValue(subprocess);

    const executor = new TestExecutor();
    const pending = executor.run('claude', ['-p', 'prompt'], { cwd: '/tmp/repo' });

    stdout.write('agent stdout');
    stderr.write('agent stderr');
    stdout.end();
    stderr.end();

    await expect(pending).resolves.toBe('final output');
    expect(execaMock).toHaveBeenCalledWith('claude', ['-p', 'prompt'], {
      cwd: '/tmp/repo',
      input: undefined,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stderrWriteSpy).toHaveBeenCalled();
    expect(execaMock.mock.calls[0]?.[2]).not.toHaveProperty('timeout');
  });
});
