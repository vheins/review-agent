import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

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
