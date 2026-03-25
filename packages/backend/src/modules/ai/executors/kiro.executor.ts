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
