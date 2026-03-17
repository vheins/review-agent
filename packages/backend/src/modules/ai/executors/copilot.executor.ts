import { Logger } from '@nestjs/common';
import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

export class CopilotExecutor extends BaseAiExecutor {
  constructor() {
    super('copilot');
  }

  async review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    this.logger.log(`Copilot reviewing PR #${pr.number}...`);
    const model = process.env.COPILOT_MODEL || 'claude-haiku-4.5';
    const prompt = this.buildReviewPrompt(pr, changedFiles);
    return this.execCli('copilot', ['--yolo', '--allow-all-tools', '--silent', '--model', model], { cwd: repoDir, input: prompt });
  }
}
