import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

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
