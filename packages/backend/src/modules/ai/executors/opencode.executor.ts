import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

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
      `🔧 Prompt length: ${prompt.length}, first 200 chars: ${prompt.substring(0, 200).replace(/\\n/g, '\\\\n')}`,
    );
    this.logger.log(`⏳ Executing opencode run command...`);

    const result = await this.execCli(opencodeBin, args, { cwd: repoDir, allowFail: true });

    this.logger.log(`✨ OpenCode output received (${result.length} chars)`);
    return result;
  }
}
