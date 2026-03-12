import { Logger } from '@nestjs/common';
import { BaseAiExecutor } from './index.js';
import { PullRequest } from '../../github/github.service.js';

export class KiroExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(KiroExecutor.name);
  constructor() { super('kiro'); }
  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`Kiro reviewing PR #${pr.number}...`);
    return "[File: src/github.js] [Line: 20] [Type: security] [Severity: high] Potential command injection.";
  }
}

export class ClaudeExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(ClaudeExecutor.name);
  constructor() { super('claude'); }
  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`Claude reviewing PR #${pr.number}...`);
    return "[File: src/app.ts] [Line: 15] [Type: logic] [Severity: critical] Incorrect logic in loop.";
  }
}

export class CodexExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(CodexExecutor.name);
  constructor() { super('codex'); }
  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`Codex reviewing PR #${pr.number}...`);
    return "[File: src/main.ts] [Line: 8] [Type: style] [Severity: low] Use arrow function instead.";
  }
}

export class OpenCodeExecutor extends BaseAiExecutor {
  private readonly logger = new Logger(OpenCodeExecutor.name);
  constructor() { super('opencode'); }
  async review(pr: PullRequest, diff: string, repoDir: string): Promise<string> {
    this.logger.log(`OpenCode reviewing PR #${pr.number}...`);
    return "[File: src/config.js] [Line: 3] [Type: security] [Severity: high] Hardcoded secret found.";
  }
}
