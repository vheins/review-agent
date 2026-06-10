import { Injectable, Logger } from '@nestjs/common';
import { GitHubClientService, Issue } from '../github/github.service.js';
import { RepositoryManagerService } from '../github/services/repository-manager.service.js';
import { AiExecutorService } from '../ai/ai-executor.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import * as path from 'path';
import * as fs from 'fs-extra';

const _cwd = process.cwd();
const PROJECT_ROOT =
  path.basename(_cwd) === 'backend' && path.basename(path.dirname(_cwd)) === 'packages'
    ? path.resolve(_cwd, '../..')
    : _cwd;

@Injectable()
export class IssueResolverService {
  private readonly logger = new Logger(IssueResolverService.name);

  constructor(
    private readonly github: GitHubClientService,
    private readonly repoManager: RepositoryManagerService,
    private readonly ai: AiExecutorService,
    private readonly config: AppConfigService,
  ) {}

  async runAll(): Promise<void> {
    this.logger.log('Starting Issue Resolution Engine...');
    const appConfig = this.config.getAppConfig();
    if (!appConfig.issueSyncEnabled) {
      this.logger.log('Issue sync is disabled via ISSUE_SYNC_ENABLED=false');
      return;
    }

    if (!appConfig.fixIssue) {
      this.logger.log(
        'Issue fix mode is disabled via FIX_ISSUE=false — skipping issue resolution cycle.',
      );
      return;
    }

    const issues = await this.github.fetchOpenIssues();
    this.logger.log(`Found ${issues.length} open issues assigned to me.`);

    for (const issue of issues) {
      await this.resolveIssue(issue);
    }

    this.logger.log('Issue Resolution Engine completed.');
  }

  private async resolveIssue(issue: Issue): Promise<void> {
    const repoName = issue.repository.nameWithOwner;
    this.logger.log(`Resolving issue ${repoName}#${issue.number}: ${issue.title}`);

    try {
      const repoDir = await this.repoManager.prepareIssueRepository(repoName);

      const appConfig = this.config.getAppConfig();
      const dryRun = appConfig.dryRun;
      const fixIssue = appConfig.fixIssue;
      const executorConfig = this.config.getAiExecutorConfig();
      const effectiveExecutor = executorConfig.executor || 'opencode';

      const prompt = this.buildIssuePrompt(issue, repoDir, dryRun, fixIssue);

      this.logger.log(`Running ${effectiveExecutor} for issue #${issue.number}...`);
      const output = await this.ai.executePrompt(effectiveExecutor, prompt, repoDir);

      this.logger.log(`Issue #${issue.number} resolution output: ${output.slice(0, 500)}`);

      if (dryRun) {
        this.logger.log(`[DryRun] Would have resolved issue #${issue.number}`);
      }

      this.logger.log(`Completed issue #${issue.number}`);
    } catch (error) {
      this.logger.error(`Failed to resolve issue #${issue.number}: ${error.message}`);
    }
  }

  private buildIssuePrompt(
    issue: Issue,
    repoDir: string,
    dryRun: boolean,
    fixIssue: boolean,
  ): string {
    const templatePath = path.resolve(PROJECT_ROOT, 'context/issue-prompt.md');
    let template = '';
    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf-8');
    }

    if (template) {
      return template
        .replace(/\{\{repository\}\}/g, issue.repository.nameWithOwner)
        .replace(/\{\{issue\.number\}\}/g, String(issue.number))
        .replace(/\{\{issue\.title\}\}/g, issue.title || '')
        .replace(/\{\{issue\.body\}\}/g, issue.body || '(no body)')
        .replace(/\{\{repoDir\}\}/g, repoDir)
        .replace(/\{\{dryRun\}\}/g, String(dryRun))
        .replace(/\{\{fixIssue\}\}/g, String(fixIssue));
    }

    return `Resolve issue #${issue.number} in ${issue.repository.nameWithOwner}: ${issue.title}`;
  }
}
