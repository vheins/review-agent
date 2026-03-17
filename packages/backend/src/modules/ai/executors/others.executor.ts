import { Logger } from '@nestjs/common';
import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

export class KiroExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(KiroExecutor.name);
  constructor() { super('kiro'); }

  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`Kiro reviewing PR #${pr.number}...`);
    const agent = process.env.KIRO_AGENT || 'auto';
    const prompt = this.buildReviewPrompt(pr, diff);
    const args = ['chat', '--message', prompt];
    if (agent !== 'auto') args.push('--agent', agent);
    return this.execCli('kiro', args);
  }
}

export class ClaudeExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(ClaudeExecutor.name);
  constructor() { super('claude'); }

  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`Claude reviewing PR #${pr.number}...`);
    const model = process.env.CLAUDE_MODEL || 'sonnet';
    const prompt = this.buildReviewPrompt(pr, diff);
    const args = ['-p', prompt, '--model', model, '--output-format', 'text'];
    return this.execCli('claude', args);
  }
}

export class CodexExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(CodexExecutor.name);
  constructor() { super('codex'); }

  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`Codex reviewing PR #${pr.number}...`);
    const model = process.env.CODEX_MODEL || 'auto';
    const prompt = this.buildReviewPrompt(pr, diff);
    const args = ['-p', prompt];
    if (model !== 'auto') args.push('--model', model);
    return this.execCli('codex', args);
  }
}

export class OpenCodeExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(OpenCodeExecutor.name);
  constructor() { super('opencode'); }

  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`OpenCode reviewing PR #${pr.number}...`);
    const model = process.env.OPENCODE_MODEL || 'auto';
    const prompt = this.buildReviewPrompt(pr, diff);
    const args = ['run', '-p', prompt];
    if (model !== 'auto') args.push('--model', model);
    return this.execCli('opencode', args);
  }
}
