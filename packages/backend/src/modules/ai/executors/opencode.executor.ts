import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';
import {
  buildOpenCodeRunArgs,
  resolveOpenCodeVersion,
  OpenCodeVersionRunner,
} from './opencode.util.js';

export class OpenCodeExecutor extends BaseAiExecutor {
  constructor() {
    super('opencode');
  }

  async review(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    this.logger.log(`OpenCode reviewing PR #${pr.number}...`);
    const model = process.env.OPENCODE_MODEL || 'auto';
    const agent = process.env.OPENCODE_AGENT || 'build';
    const variant = process.env.OPENCODE_VARIANT || 'max';
    const prompt = this.buildReviewPrompt(pr, changedFiles);

    const opencodeBin = process.env.OPENCODE_BIN || 'opencode';

    const versionRunner: OpenCodeVersionRunner = (cmd, cliArgs) =>
      this.execCli(cmd, cliArgs, { allowFail: true });
    const version = await resolveOpenCodeVersion(opencodeBin, versionRunner);

    const args = buildOpenCodeRunArgs({
      version,
      repoDir,
      model,
      agent,
      variant,
      prompt,
    });

    this.logger.debug(`🔧 OpenCode (${version}) args: ${JSON.stringify(args)}`);
    this.logger.debug(
      `🔧 Prompt length: ${prompt.length}, first 200 chars: ${prompt.substring(0, 200).replace(/\n/g, '\\n')}`,
    );
    this.logger.log(`⏳ Executing opencode run command...`);

    const result = await this.execCli(opencodeBin, args, { cwd: repoDir });

    this.logger.log(`✨ OpenCode output received (${result.length} chars)`);
    return result;
  }
}
