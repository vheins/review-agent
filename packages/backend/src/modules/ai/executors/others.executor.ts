import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

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
      '--dangerously-skip-permissions'
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

export class OpenCodeExecutor extends BaseAiExecutor {
  constructor() {
    super('opencode');
  }

  async review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    this.logger.log(`OpenCode reviewing PR #${pr.number}...`);
    const model = process.env.OPENCODE_MODEL || 'auto';
    const agent = process.env.OPENCODE_AGENT || 'build';
    const prompt = this.buildReviewPrompt(pr, changedFiles);

    const opencodeBin = process.env.OPENCODE_BIN || '/home/vheins/.opencode/bin/opencode';

    const args = ['run'];
    if (model !== 'auto') args.push('--model', model);
    if (agent) args.push('--agent', agent);
    args.push(prompt);

    this.logger.debug(`🔧 OpenCode args: ${JSON.stringify(args)}`);
    this.logger.debug(
      `🔧 Prompt length: ${prompt.length}, first 200 chars: ${prompt.substring(0, 200).replace(/\n/g, '\\n')}`,
    );
    this.logger.log(`⏳ Executing opencode run command...`);

    const result = await this.execCli(opencodeBin, args, { cwd: repoDir, allowFail: true });

    this.logger.log(`✨ OpenCode output received (${result.length} chars)`);
    return result;
  }
}
