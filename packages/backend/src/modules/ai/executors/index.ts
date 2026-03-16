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
  review(pr: PullRequest, diff: string, repoDir: string): Promise<string>;
}

/**
 * Base AI Executor class
 */
export abstract class BaseAiExecutor implements AiExecutor {
  constructor(public readonly name: string) {}

  abstract review(pr: PullRequest, diff: string, repoDir: string): Promise<string>;

  protected buildReviewPrompt(pr: PullRequest, diff: string): string {
    const agentsMd = this.loadAgentsMd();
    return `${agentsMd}

Review the following Pull Request:
Title: ${pr.title}
Repository: ${pr.repository.nameWithOwner}

Diff:
${diff}

Please provide your review in the following format for each issue found:
[File: path/to/file] [Line: line_number] [Type: security|quality|style|logic] [Severity: critical|high|medium|low] Message...
    `.trim();
  }

  private loadAgentsMd(): string {
    const candidates = [
      path.resolve(process.cwd(), 'agents.md'),
      path.resolve(process.cwd(), 'context/review-prompt.md'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
    }
    return '';
  }

  protected async execCli(cmd: string, args: string[], input?: string): Promise<string> {
    const { stdout } = await execa(cmd, args, {
      input,
      timeout: 300_000,
      all: true,
    });
    return stdout;
  }

  protected async execCliWithPromptFile(cmd: string, args: (string | (() => string[]))[], prompt: string): Promise<string> {
    const tmpFile = path.join(os.tmpdir(), `review-prompt-${Date.now()}.md`);
    try {
      await fs.writeFile(tmpFile, prompt, 'utf-8');
      const resolvedArgs = args.map(a => typeof a === 'function' ? a() : a).flat() as string[];
      const finalArgs = resolvedArgs.map(a => a === '__PROMPT_FILE__' ? tmpFile : a);
      return await this.execCli(cmd, finalArgs);
    } finally {
      await fs.remove(tmpFile).catch(() => {});
    }
  }
}
