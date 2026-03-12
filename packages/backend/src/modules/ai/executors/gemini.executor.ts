import { Logger } from '@nestjs/common';
import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

export class GeminiExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(GeminiExecutor.name);

  constructor() {
    super('gemini');
  }

  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`Gemini reviewing PR #${pr.number}...`);
    // Simulation: In a real app, this would use the Gemini API or CLI
    return "[File: src/app.js] [Line: 10] [Type: quality] [Severity: medium] Code could be more concise.";
  }
}
