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
    return "[File: src/index.js] [Line: 5] [Type: style] [Severity: low] Missing semicolon.";
  }
}
