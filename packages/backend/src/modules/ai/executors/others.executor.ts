import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

export { OpenCodeExecutor } from './opencode.executor.js';

export class KiroExecutor extends BaseAiExecutor {
  constructor() {
    super('kiro');
  }

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
  constructor() {
    super('claude');
  }

  async review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    const model = process.env.CLAUDE_MODEL || 'sonnet';
    const agent = process.env.CLAUDE_AGENT || '';

    this.logger.log(`▶ Claude reviewing PR #${pr.number} (model: ${model}, yolo: ALWAYS)...`);
    this.logger.debug(`📋 Files to review: ${changedFiles.length} changed files`);

    const prompt = this.buildReviewPrompt(pr, changedFiles);
    const args = [
      '-p',
      prompt,
      '--model',
      model,
      '--output-format',
      'text',
      '--add-dir',
      repoDir,
      '--dangerously-skip-permissions',
    ];
    if (agent) args.push('--agent', agent);

    this.logger.debug(`🔧 Claude args: ${args.join(' ')}`);
    this.logger.log(`⏳ Executing claude -p command...`);

    const result = await this.execCli('claude', args, { cwd: repoDir });

    this.logger.log(`✨ Claude output received (${result.length} chars)`);
    return result;
  }
}

export class CodexExecutor extends BaseAiExecutor {
  constructor() {
    super('codex');
  }

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
