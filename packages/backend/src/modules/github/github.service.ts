import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../../config/app-config.service.js';
import { GithubApiService } from './services/github-api.service.js';
import { GithubCliService } from './services/github-cli.service.js';

/**
 * PullRequest Interface
 */
export interface PullRequest {
  number: number;
  title: string;
  repository: {
    nameWithOwner: string;
  };
  url: string;
  updatedAt: string;
  state: string;
  headRefName?: string;
  baseRefName?: string;
  author: {
    login: string;
  };
}

/**
 * Issue Interface
 */
export interface Issue {
  number: number;
  title: string;
  repository: {
    nameWithOwner: string;
  };
  url: string;
  updatedAt: string;
  state: string;
  author: {
    login: string;
  };
}

/**
 * GitHubClientService - Orchestrates GitHub operations with API-first and CLI-fallback strategy
 */
@Injectable()
export class GitHubClientService {
  private readonly logger = new Logger(GitHubClientService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly configService: ConfigService,
    private readonly api: GithubApiService,
    private readonly cli: GithubCliService,
  ) {}

  /**
   * Helper to proxy execaVerbose from CLI service for backward compatibility
   */
  async execaVerbose(cmd: string, args: string[], opts: any = {}) {
    return this.cli.execaVerbose(cmd, args, opts);
  }

  /**
   * Fetch open Pull Requests based on configured scope
   */
  async fetchOpenPRs(): Promise<PullRequest[]> {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    const appConfig = this.config.getAppConfig();

    if (token) {
      try {
        this.logger.log('► Fetching PRs via GitHub API...');
        const filters = [];
        if (appConfig.prScope.includes('authored')) filters.push('author:@me');
        if (appConfig.prScope.includes('assigned')) filters.push('assignee:@me');
        if (appConfig.prScope.includes('review-requested')) filters.push('review-requested:@me');

        if (filters.length > 0) {
          const query = `is:pr (${filters.join(' OR ')})`;
          const result = await this.api.searchPRs(query);
          
          const prs: PullRequest[] = result.items.map(item => ({
            number: item.number,
            title: item.title,
            repository: {
              nameWithOwner: item.repository_url.split('repos/')[1]
            },
            url: item.html_url,
            updatedAt: item.updated_at,
            state: item.state,
            author: {
              login: item.user?.login || 'unknown'
            }
          }));

          return this.processPRs(prs);
        }
      } catch (apiError) {
        this.logger.warn(`GitHub API fetch failed, falling back to CLI: ${apiError.message}`);
      }
    }

    // Fallback to CLI
    const allPRs: PullRequest[] = [];
    const scopeActions = [
      { scope: 'authored',         flag: '--author=@me',           label: 'authored by @me' },
      { scope: 'assigned',         flag: '--assignee=@me',         label: 'assigned to @me' },
      { scope: 'review-requested', flag: '--review-requested=@me', label: 'review-requested @me' },
    ];

    for (const { scope, flag } of scopeActions) {
      if (!appConfig.prScope.includes(scope)) continue;
      const items = await this.cli.searchPRs(flag);
      allPRs.push(...items);
    }

    return this.processPRs(allPRs);
  }

  /**
   * Fetch open issues
   */
  async fetchOpenIssues(): Promise<Issue[]> {
    const token = this.configService.get<string>('GITHUB_TOKEN');

    if (token) {
      try {
        this.logger.log('► Fetching issues via GitHub API...');
        const result = await this.api.searchIssues('is:issue+is:open+mentions:@me');
        return result.items.map(item => ({
          number: item.number,
          title: item.title,
          repository: {
            nameWithOwner: item.repository_url.split('repos/')[1]
          },
          url: item.html_url,
          updatedAt: item.updated_at,
          state: item.state,
          author: {
            login: item.user?.login || 'unknown'
          }
        }));
      } catch (apiError) {
        this.logger.warn(`GitHub API issue fetch failed, falling back to CLI: ${apiError.message}`);
      }
    }

    return this.cli.searchIssues();
  }

  /**
   * Internal helper to deduplicate, filter and enrich PR data
   */
  private async processPRs(prs: PullRequest[]): Promise<PullRequest[]> {
    const appConfig = this.config.getAppConfig();
    const uniquePRs = Array.from(new Map(prs.map(pr => [pr.url, pr])).values());
    
    const filteredPRs = uniquePRs.filter(pr => {
      const owner = pr.repository.nameWithOwner.split('/')[0];
      return !appConfig.excludeRepoOwners.includes(owner);
    });

    filteredPRs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    for (const pr of filteredPRs) {
      if (pr.state !== 'OPEN' && pr.state !== 'open') continue;
      
      try {
        const token = this.configService.get<string>('GITHUB_TOKEN');
        if (token) {
          const detail = await this.api.getPRDetail(pr.repository.nameWithOwner, pr.number);
          pr.headRefName = detail.head.ref;
          pr.baseRefName = detail.base.ref;
        } else {
          throw new Error('No token');
        }
      } catch (e) {
        try {
          const detail = await this.cli.getPRDetail(pr.repository.nameWithOwner, pr.number);
          pr.headRefName = detail.headRefName;
          pr.baseRefName = detail.baseRefName;
        } catch (err) {
          this.logger.warn(`Failed to fetch details for PR ${pr.repository.nameWithOwner}#${pr.number}`);
        }
      }
    }

    return filteredPRs;
  }

  /**
   * Prepare repository locally for review (clone/fetch and checkout)
   */
  async prepareRepository(pr: PullRequest): Promise<string> {
    const repoName = pr.repository.nameWithOwner;
    const appConfig = this.config.getAppConfig();
    const repoDir = path.join(appConfig.workspaceDir, repoName.replace('/', '-'));

    try {
      if (await fs.pathExists(repoDir)) {
        this.logger.log(`Fetching latest changes for existing repository at ${repoDir}`);
        await this.cli.execaVerbose('git', ['fetch', 'origin'], { cwd: repoDir });
        await this.cli.execaVerbose('git', ['checkout', pr.headRefName!], { cwd: repoDir });
        await this.cli.execaVerbose('git', ['reset', '--hard', `origin/${pr.headRefName}`], { cwd: repoDir });
        await this.cli.execaVerbose('git', ['clean', '-fd'], { cwd: repoDir });
      } else {
        this.logger.log(`Cloning repository ${repoName} to ${repoDir}`);
        await this.cli.execaVerbose('git', ['clone', `git@github.com:${repoName}.git`, repoDir]);
        await this.cli.execaVerbose('git', ['checkout', pr.headRefName!], { cwd: repoDir });
      }
      return repoDir;
    } catch (error) {
      this.logger.error(`Failed to prepare repository: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a review comment to a Pull Request
   */
  async addReview(repoName: string, prNumber: number, body: string, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT'): Promise<boolean> {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      try {
        await this.api.addReview(repoName, prNumber, body, event);
        return true;
      } catch (apiError) {
        this.logger.warn(`API review failed, falling back to CLI: ${apiError.message}`);
      }
    }

    try {
      await this.cli.addReview(repoName, prNumber, body, event);
      return true;
    } catch (e) {
      this.logger.error(`Failed to add review: ${e.message}`);
      return false;
    }
  }

  /**
   * Merge a Pull Request
   */
  async mergePR(repoName: string, prNumber: number, method: 'squash' | 'merge' | 'rebase' = 'squash'): Promise<boolean> {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      try {
        await this.api.mergePR(repoName, prNumber, method);
        return true;
      } catch (apiError) {
        this.logger.warn(`API merge failed, falling back to CLI: ${apiError.message}`);
      }
    }

    try {
      await this.cli.mergePR(repoName, prNumber, method);
      return true;
    } catch (e) {
      this.logger.error(`Failed to merge PR: ${e.message}`);
      return false;
    }
  }

  /**
   * Fetch PR checks
   */
  async getPRChecks(repoName: string, prNumber: number): Promise<any[]> {
    try {
      // GitHub API for checks is a bit complex (Check Runs API), 
      // CLI 'pr checks' is very convenient. API implementation can be added if needed.
      return await this.cli.getPRChecks(repoName, prNumber);
    } catch (e) {
      this.logger.error(`Failed to fetch PR checks: ${e.message}`);
      return [];
    }
  }

  /**
   * Get summarized test results
   */
  async getTestResults(repoName: string, prNumber: number) {
    const checks = await this.getPRChecks(repoName, prNumber);
    
    return {
      total: checks.length,
      passed: checks.filter(c => c.conclusion === 'success').length,
      failed: checks.filter(c => c.conclusion === 'failure').length,
      pending: checks.filter(c => c.status === 'in_progress' || c.status === 'queued').length,
      allPassed: checks.length > 0 && checks.every(c => c.conclusion === 'success' || c.conclusion === 'neutral' || c.conclusion === 'skipped'),
      details: checks
    };
  }

  /**
   * Assign reviewers to a Pull Request
   */
  async assignReviewers(repoName: string, prNumber: number, reviewers: string[] = []): Promise<boolean> {
    if (reviewers.length === 0) return true;
    const token = this.configService.get<string>('GITHUB_TOKEN');
    
    if (token) {
      try {
        await this.api.assignReviewers(repoName, prNumber, reviewers);
        return true;
      } catch (apiError) {
        this.logger.warn(`API assignment failed, falling back to CLI: ${apiError.message}`);
      }
    }

    try {
      await this.cli.assignReviewers(repoName, prNumber, reviewers);
      return true;
    } catch (e) {
      this.logger.error(`Failed to assign reviewers: ${e.message}`);
      return false;
    }
  }

  /**
   * Get files changed in a Pull Request
   */
  async getChangedFiles(repoDir: string, pr: PullRequest): Promise<{ path: string; content: string }[]> {
    try {
      const { stdout } = await this.cli.execaVerbose('git', ['diff', '--name-only', `${pr.baseRefName}...${pr.headRefName}`], { cwd: repoDir });
      const filePaths = stdout.split('\n').filter(line => line.trim() !== '');
      
      const changedFiles: { path: string; content: string }[] = [];
      for (const filePath of filePaths) {
        const fullPath = path.join(repoDir, filePath);
        if (await fs.pathExists(fullPath)) {
          const stats = await fs.stat(fullPath);
          if (stats.isFile()) {
            const content = await fs.readFile(fullPath, 'utf8');
            changedFiles.push({ path: filePath, content });
          }
        }
      }
      return changedFiles;
    } catch (error) {
      this.logger.error(`Failed to get changed files: ${error.message}`);
      return [];
    }
  }
}
