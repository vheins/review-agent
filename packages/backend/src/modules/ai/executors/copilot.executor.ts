import { Logger } from '@nestjs/common';
import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

export class CopilotExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(CopilotExecutor.name);

  constructor() {
    super('copilot');
  }

  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`Copilot reviewing PR #${pr.number}...`);
    const model = process.env.COPILOT_MODEL || 'claude-haiku-4.5';
    const prompt = this.buildReviewPrompt(pr, diff);
    return this.execCli('gh', ['copilot', 'suggest', '-t', 'shell', prompt, '--model', model]);
  }
}
