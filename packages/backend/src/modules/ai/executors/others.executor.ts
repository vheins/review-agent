import { Logger } from '@nestjs/common';
import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

export class KiroExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(KiroExecutor.name);
  constructor() { super('kiro'); }

  async review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    this.logger.log(`Kiro reviewing PR #${pr.number}...`);
    const agent = process.env.KIRO_AGENT || 'auto';
    const prompt = this.buildReviewPrompt(pr, changedFiles);
    const args = ['chat', '--no-interactive', '--trust-all-tools'];
    if (agent !== 'auto') args.push('--agent', agent);
    return this.execCli('kiro-cli', args, { cwd: repoDir, input: prompt });
  }
}

export class ClaudeExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(ClaudeExecutor.name);
  constructor() { super('claude'); }

  async review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    this.logger.log(`Claude reviewing PR #${pr.number}...`);
    const model = process.env.CLAUDE_MODEL || 'sonnet';
    const agent = process.env.CLAUDE_AGENT || '';
    const yolo = process.env.CLAUDE_YOLO !== 'false';
    const prompt = this.buildReviewPrompt(pr, changedFiles);
    const args = ['--print', '--model', model, '--output-format', 'text', '--add-dir', repoDir, '--permission-mode', yolo ? 'bypassPermissions' : 'dontAsk', '-p', '__PROMPT_FILE__'];
    if (agent) args.push('--agent', agent);
    if (yolo) args.push('--dangerously-skip-permissions');
    return this.execCliWithPromptFile('claude', args, prompt, { cwd: repoDir });
  }
}

export class CodexExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(CodexExecutor.name);
  constructor() { super('codex'); }

  async review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    this.logger.log(`Codex reviewing PR #${pr.number}...`);
    const model = process.env.CODEX_MODEL || 'auto';
    const yolo = process.env.CODEX_YOLO !== 'false';
    const prompt = this.buildReviewPrompt(pr, changedFiles);
    const args = ['exec', '-', '--cd', repoDir];
    if (model !== 'auto') args.push('--model', model);
    if (yolo) {
      args.push('--dangerously-bypass-approvals-and-sandbox');
    } else {
      args.push('--sandbox', 'read-only');
    }
    return this.execCli('codex', args, { cwd: repoDir, input: prompt });
  }
}

export class OpenCodeExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(OpenCodeExecutor.name);
  constructor() { super('opencode'); }

  async review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    this.logger.log(`OpenCode reviewing PR #${pr.number}...`);
    const model = process.env.OPENCODE_MODEL || 'auto';
    const agent = process.env.OPENCODE_AGENT || '';
    const prompt = this.buildReviewPrompt(pr, changedFiles);
    const args = ['run', '--dir', repoDir];
    if (model !== 'auto') args.push('--model', model);
    if (agent) args.push('--agent', agent);
    args.push(prompt);
    return this.execCli('opencode', args, { cwd: repoDir });
  }
}
