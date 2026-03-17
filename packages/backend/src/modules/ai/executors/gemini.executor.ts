import { Logger } from '@nestjs/common';
import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

export class GeminiExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(GeminiExecutor.name);

  constructor() {
    super('gemini');
  }

  async review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    this.logger.log(`Gemini reviewing PR #${pr.number}...`);
    const model = process.env.GEMINI_MODEL || 'auto-3';
    const prompt = this.buildReviewPrompt(pr, changedFiles);
    const args = ['--yolo'];
    if (model && !model.startsWith('auto')) args.push('--model', model);
    return this.execCli('gemini', args, { cwd: repoDir, input: prompt });
  }
}
