import { Injectable, Logger } from '@nestjs/common';
import { execa, Options as ExecaOptions } from 'execa';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../../config/app-config.service.js';

/**
 * PullRequest Interface
 * Based on GitHub CLI JSON output
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
 * GitHubClientService - NestJS Service for GitHub CLI and API operations
 */
@Injectable()
export class GitHubClientService {
  private readonly logger = new Logger(GitHubClientService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Helper for GitHub API requests
   */
  private async fetchApi(endpoint: string, options: any = {}) {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (!token) {
      throw new Error('GITHUB_TOKEN is not configured');
    }

    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PR-Review-Agent',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`GitHub API Error: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Execute a command with verbose logging
   */
  async execaVerbose(cmd: string, args: string[], opts: any = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const label = chalk.magenta(`[exec]`) + ' ' + chalk.white(`${cmd} ${args.join(' ')}`);
    this.logger.log(`▶ ${label}`);

    const proc = execa(cmd, args, {
      ...opts,
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
    });

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    if (proc.stdout) {
      proc.stdout.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const cleaned = stripAnsi(line);
          if (cleaned.trim()) {
            process.stdout.write(chalk.gray('  │ ') + cleaned + '\n');
            stdoutLines.push(cleaned);
          }
        }
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const cleaned = stripAnsi(line);
          if (cleaned.trim()) {
            process.stdout.write(chalk.yellow('  │ ') + cleaned + '\n');
            stderrLines.push(cleaned);
          }
        }
      });
    }

    const result = await proc;

    let stdout = stdoutLines.join('\n');
    if (!stdout && result.stdout) {
      stdout = stripAnsi(result.stdout);
    }

    let stderr = stderrLines.join('\n');
    if (!stderr && result.stderr) {
      stderr = stripAnsi(result.stderr);
    }

    if (result.exitCode !== 0) {
      if (!opts.allowFail) {
        const err = new Error(stderr || `${cmd} failed with exit code ${result.exitCode}`) as any;
        err.exitCode = result.exitCode;
        throw err;
      }
      this.logger.warn(`✖ ${cmd} exited with code ${result.exitCode} (allowed)`);
    } else {
      this.logger.log(`✔ ${cmd} completed (exit 0)`);
    }

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: result.exitCode || 0,
    };
  }

  /**
   * Fetch open Pull Requests based on configured scope
   */
  async fetchOpenPRs(): Promise<PullRequest[]> {
    try {
      this.logger.log('╔══ STEP: fetchOpenPRs (Last 100, All States)');
      const appConfig = this.config.getAppConfig();
      const token = this.configService.get<string>('GITHUB_TOKEN');

      // Try API first if token is available
      if (token) {
        try {
          this.logger.log('► Attempting to fetch last 100 PRs via GitHub API...');
          
          const filters = [];
          if (appConfig.prScope.includes('authored')) filters.push('author:@me');
          if (appConfig.prScope.includes('assigned')) filters.push('assignee:@me');
          if (appConfig.prScope.includes('review-requested')) filters.push('review-requested:@me');

          if (filters.length === 0) return [];

          const query = encodeURIComponent(`is:pr ${filters.join(' ')}`);
          // Note: GitHub search defaults to AND. If we want OR, we need separate queries or use the OR operator.
          // To keep it simple and reliable, we'll join them with OR if multiple filters exist.
          const orQuery = filters.length > 1 
            ? encodeURIComponent(`is:pr ${filters.join(' OR ')}`)
            : query;

          const result = await this.fetchApi(`/search/issues?q=${orQuery}&per_page=100&sort=updated&order=desc`);
          
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

          this.logger.log(`  Found ${prs.length} PRs via API`);
          return this.processPRs(prs);
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

      for (const { scope, flag, label } of scopeActions) {
        if (!appConfig.prScope.includes(scope)) continue;

        this.logger.log(`► Fetching last 100 PRs ${label} via CLI...`);
        const { stdout } = await this.execaVerbose('gh', [
          'search', 'prs',
          flag,
          '--limit', '100',
          '--json', 'number,title,repository,url,updatedAt,state,author',
        ]);
        const items = JSON.parse(stdout || '[]');
        this.logger.log(`  Found ${items.length} PRs (${label})`);
        allPRs.push(...items);
      }

      return this.processPRs(allPRs);
    } catch (error) {
      this.logger.error(`Failed to fetch PRs: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Fetch open issues
   */
  async fetchOpenIssues(): Promise<Issue[]> {
    try {
      this.logger.log('╔══ STEP: fetchOpenIssues');
      const token = this.configService.get<string>('GITHUB_TOKEN');

      if (token) {
        try {
          this.logger.log('► Fetching last 100 issues via GitHub API...');
          const result = await this.fetchApi(`/search/issues?q=is:issue+is:open+mentions:@me&per_page=100&sort=updated&order=desc`);
          
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

      const { stdout } = await this.execaVerbose('gh', [
        'search', 'issues',
        '--state=open',
        '--mentions=@me',
        '--limit', '100',
        '--json', 'number,title,repository,url,updatedAt,state,author',
      ]);
      return JSON.parse(stdout || '[]');
    } catch (error) {
      this.logger.error(`Failed to fetch issues: ${error.message}`);
      throw error;
    }
  }

  /**
   * Internal helper to deduplicate, filter and enrich PR data
   */
  private async processPRs(prs: PullRequest[]): Promise<PullRequest[]> {
    const appConfig = this.config.getAppConfig();
    
    // Deduplicate by URL
    const uniquePRs = Array.from(new Map(prs.map(pr => [pr.url, pr])).values());
    
    const filteredPRs = uniquePRs.filter(pr => {
      const owner = pr.repository.nameWithOwner.split('/')[0];
      return !appConfig.excludeRepoOwners.includes(owner);
    });

    filteredPRs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Fetch headRefName and baseRefName for each PR (only for open ones)
    for (const pr of filteredPRs) {
      if (pr.state !== 'OPEN' && pr.state !== 'open') continue;
      
      try {
        const token = this.configService.get<string>('GITHUB_TOKEN');
        if (token) {
          const detail = await this.fetchApi(`/repos/${pr.repository.nameWithOwner}/pulls/${pr.number}`);
          pr.headRefName = detail.head.ref;
          pr.baseRefName = detail.base.ref;
        } else {
          throw new Error('No token');
        }
      } catch (e) {
        // Fallback to CLI for details
        try {
          const { stdout: detailJson } = await this.execaVerbose('gh', [
            'pr', 'view', pr.number.toString(),
            '--repo', pr.repository.nameWithOwner,
            '--json', 'headRefName,baseRefName',
          ], { allowFail: true });
          const detail = JSON.parse(detailJson || '{}');
          pr.headRefName = detail.headRefName;
          pr.baseRefName = detail.baseRefName;
        } catch (err) {
          // Ignore if detail fetch fails
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
        await this.execaVerbose('git', ['fetch', 'origin'], { cwd: repoDir });
        await this.execaVerbose('git', ['checkout', pr.headRefName!], { cwd: repoDir });
        await this.execaVerbose('git', ['reset', '--hard', `origin/${pr.headRefName}`], { cwd: repoDir });
        await this.execaVerbose('git', ['clean', '-fd'], { cwd: repoDir });
      } else {
        this.logger.log(`Cloning repository ${repoName} to ${repoDir}`);
        await this.execaVerbose('git', ['clone', `git@github.com:${repoName}.git`, repoDir]);
        await this.execaVerbose('git', ['checkout', pr.headRefName!], { cwd: repoDir });
      }
      return repoDir;
    } catch (error) {
      this.logger.error(`Failed to prepare repository: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Add a review comment to a Pull Request
   */
  async addReview(repoName: string, prNumber: number, body: string, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT'): Promise<boolean> {
    try {
      this.logger.log(`Adding ${event} review to ${repoName}#${prNumber}`);
      
      const token = this.configService.get<string>('GITHUB_TOKEN');
      if (token) {
        try {
          await this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews`, {
            method: 'POST',
            body: JSON.stringify({
              body,
              event
            })
          });
          return true;
        } catch (apiError) {
          this.logger.warn(`API review failed, falling back to CLI: ${apiError.message}`);
        }
      }

      await this.execaVerbose('gh', [
        'pr', 'review', prNumber.toString(),
        '--repo', repoName,
        '--body', body,
        `--${event.toLowerCase()}`
      ]);
      return true;
    } catch (e) {
      this.logger.error(`Failed to add review: ${e.message}`, e.stack);
      return false;
    }
  }

  /**
   * Merge a Pull Request
   */
  async mergePR(repoName: string, prNumber: number, method: 'squash' | 'merge' | 'rebase' = 'squash'): Promise<boolean> {
    try {
      this.logger.log(`Merging PR ${repoName}#${prNumber} using ${method}`);
      
      const token = this.configService.get<string>('GITHUB_TOKEN');
      if (token) {
        try {
          await this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/merge`, {
            method: 'PUT',
            body: JSON.stringify({
              merge_method: method
            })
          });
          return true;
        } catch (apiError) {
          this.logger.warn(`API merge failed, falling back to CLI: ${apiError.message}`);
        }
      }

      await this.execaVerbose('gh', [
        'pr', 'merge', prNumber.toString(),
        '--repo', repoName,
        `--${method}`,
        '--delete-branch'
      ]);
      return true;
    } catch (e) {
      this.logger.error(`Failed to merge PR: ${e.message}`, e.stack);
      return false;
    }
  }

  /**
   * Assign reviewers to a Pull Request
   */
  async assignReviewers(repoName: string, prNumber: number, reviewers: string[] = []): Promise<boolean> {
    if (reviewers.length === 0) return true;
    try {
      this.logger.log(`Assigning reviewers to ${repoName}#${prNumber}: ${reviewers.join(', ')}`);
      
      const token = this.configService.get<string>('GITHUB_TOKEN');
      if (token) {
        try {
          await this.fetchApi(`/repos/${repoName}/issues/${prNumber}/assignees`, {
            method: 'POST',
            body: JSON.stringify({
              assignees: reviewers
            })
          });
          return true;
        } catch (apiError) {
          this.logger.warn(`API assignment failed, falling back to CLI: ${apiError.message}`);
        }
      }

      await this.execaVerbose('gh', [
        'pr', 'edit', prNumber.toString(),
        '--repo', repoName,
        '--add-reviewer', reviewers.join(',')
      ]);
      return true;
    } catch (e) {
      this.logger.error(`Failed to assign reviewers: ${e.message}`, e.stack);
      return false;
    }
  }

  /**
   * Get files changed in a Pull Request
   */
  async getChangedFiles(repoDir: string, pr: PullRequest): Promise<{ path: string; content: string }[]> {
    try {
      const { stdout } = await this.execaVerbose('git', ['diff', '--name-only', `${pr.baseRefName}...${pr.headRefName}`], { cwd: repoDir });
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
