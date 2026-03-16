import { Logger } from '@nestjs/common';
import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

export class GeminiExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(GeminiExecutor.name);
  public model: any;

  constructor() {
    super('gemini');
    this.model = {
      generateContent: async (prompt: string) => ({
        response: { text: () => 'AI Fixed: Corrected code content' }
      })
    };
  }

  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`Gemini reviewing PR #${pr.number}...`);
    const model = process.env.GEMINI_MODEL || 'auto-3';
    const yolo = process.env.GEMINI_YOLO === 'true';
    const prompt = this.buildReviewPrompt(pr, diff);

    const args = ['--model', model, '-p', prompt];
    if (yolo) args.push('--yolo');

    return this.execCli('gemini', args);
  }
}
