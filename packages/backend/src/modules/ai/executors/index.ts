import { PullRequest } from '../../github/github.service.js';
import { execa } from 'execa';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

/**
 * AI Review Comment Interface
 */
export interface AiReviewComment {
  file_path: string;
  line_number: number;
  issue_type: 'security' | 'quality' | 'style' | 'logic' | 'general';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggested_fix?: string;
  is_auto_fixable: boolean;
}

/**
 * AI Executor Interface
 */
export interface AiExecutor {
  readonly name: string;
  review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string>;
}

export interface ExecCliOptions {
  cwd?: string;
  input?: string;
  allowFail?: boolean;
}

/**
 * Base AI Executor class
 */
export abstract class BaseAiExecutor implements AiExecutor {
  constructor(public readonly name: string) {}

  abstract review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string>;

  protected buildReviewPrompt(pr: PullRequest, changedFiles: string[]): string {
    const [owner, repo] = pr.repository.nameWithOwner.split('/');
    const guidelines = this.loadFile('agents.md');
    const template = this.loadFile('context/review-prompt.md');

    const severityThreshold = parseInt(process.env.SEVERITY_THRESHOLD || '10', 10);
    const severityCritical = parseInt(process.env.SEVERITY_CRITICAL || '5', 10);
    const severityHigh = parseInt(process.env.SEVERITY_HIGH || '3', 10);
    const severityMedium = parseInt(process.env.SEVERITY_MEDIUM || '2', 10);
    const severityLow = parseInt(process.env.SEVERITY_LOW || '1', 10);

    if (template) {
      return template
        .replace(/\{\{repository\}\}/g, pr.repository.nameWithOwner)
        .replace(/\{\{pr\.number\}\}/g, String(pr.number))
        .replace(/\{\{pr\.title\}\}/g, pr.title)
        .replace(/\{\{guidelines\}\}/g, guidelines)
        .replace(/\{\{severityThreshold\}\}/g, String(severityThreshold))
        .replace(/\{\{severityCritical\}\}/g, String(severityCritical))
        .replace(/\{\{severityHigh\}\}/g, String(severityHigh))
        .replace(/\{\{severityMedium\}\}/g, String(severityMedium))
        .replace(/\{\{severityLow\}\}/g, String(severityLow));
    }

    // Fallback if template not found
    return `${guidelines}\n\nReview PR #${pr.number}: ${pr.title}\nRepository: ${pr.repository.nameWithOwner}`;
  }

  private loadFile(relativePath: string): string {
    const p = path.resolve(process.cwd(), relativePath);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
    return '';
  }

  protected async execCli(cmd: string, args: string[], options: ExecCliOptions = {}): Promise<string> {
    const { allowFail, input, ...execaOpts } = options as any;
    const proc = execa(cmd, args, {
      ...execaOpts,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: input !== undefined ? 'pipe' : 'ignore',
      reject: false,
    });

    if (input !== undefined && proc.stdin) {
      proc.stdin.write(input);
      proc.stdin.end();
    }

    const stdoutLines: string[] = [];
    let stdoutBuf = '';

    function flushLines(buf: string): string {
      const parts = buf.split('\n');
      const remaining = parts.pop()!;
      for (const part of parts) {
        if (part.trim()) {
          process.stdout.write('  │ ' + part + '\n');
          stdoutLines.push(part);
        }
      }
      return remaining;
    }

    if (proc.stdout) {
      proc.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString();
        stdoutBuf = flushLines(stdoutBuf);
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        process.stderr.write(chunk);
      });
    }

    const result = await proc;

    if (stdoutBuf.trim()) {
      process.stdout.write('  │ ' + stdoutBuf + '\n');
      stdoutLines.push(stdoutBuf);
    }

    if (result.exitCode !== 0 && !allowFail) {
      const err = new Error(result.stderr || `${cmd} failed with exit code ${result.exitCode}`) as any;
      err.exitCode = result.exitCode;
      throw err;
    }

    return stdoutLines.join('\n');
  }

  protected async execCliWithPromptFile(
    cmd: string,
    args: (string | (() => string[]))[],
    prompt: string,
    options: ExecCliOptions = {},
  ): Promise<string> {
    const tmpFile = path.join(os.tmpdir(), `review-prompt-${Date.now()}.md`);
    try {
      await fs.writeFile(tmpFile, prompt, 'utf-8');
      const resolvedArgs = args.map(a => typeof a === 'function' ? a() : a).flat() as string[];
      const finalArgs = resolvedArgs.map(a => a === '__PROMPT_FILE__' ? tmpFile : a);
      return await this.execCli(cmd, finalArgs, options);
    } finally {
      await fs.remove(tmpFile).catch(() => {});
    }
  }
}
