import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import fs from 'fs-extra';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../../config/app-config.service.js';
import { GithubApiService } from './services/github-api.service.js';
import { GithubCliService } from './services/github-cli.service.js';

export interface PullRequest {
  id: string; // node_id
  github_id: number | null;
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  state: string;
  locked: boolean;
  active_lock_reason?: string | null;
  draft: boolean;
  repository: {
    nameWithOwner: string;
  };
  url: string; // html_url
  diff_url?: string;
  patch_url?: string;
  updatedAt: string;
  createdAt: string;
  closedAt?: string | null;
  mergedAt?: string | null;
  headRefName?: string;
  headSha?: string;
  baseRefName?: string;
  baseSha?: string;
  merge_commit_sha?: string | null;
  author: {
    login: string;
    id?: number;
  };
  labels: string[];
  requested_reviewers?: string[];
  milestone?: string | null;
  auto_merge?: any | null;
  mergeable?: boolean | null;
  mergeable_state?: string | null;
  merged?: boolean;
  mergedBy?: string | null;
  stats?: {
    commits: number;
    additions: number;
    deletions: number;
    changed_files: number;
    comments: number;
    review_comments: number;
  };
}

/**
 * Issue Interface
 */
export interface Issue {
  id: number;
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  state: string;
  repository: {
    nameWithOwner: string;
  };
  url: string;
  updatedAt: string;
  createdAt: string;
  author: {
    login: string;
    id?: number;
  };
  labels: string[];
}

/**
 * GitHubClientService - Orchestrates GitHub operations with API-first and CLI-fallback strategy
 */
@Injectable()
export class GitHubClientService {
  private readonly logger = new Logger(GitHubClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly config: AppConfigService,
    private readonly api: GithubApiService,
    private readonly cli: GithubCliService,
  ) {}

  async execaVerbose(cmd: string, args: string[], opts: any = {}) {
    return this.cli.execaVerbose(cmd, args, opts);
  }

  /**
   * Fetch open Pull Requests based on configured scope
   */
  async fetchOpenPRs(): Promise<PullRequest[]> {
    const appConfig = this.config.getAppConfig();
    const token = this.configService.get<string>('GITHUB_TOKEN');
    const username = this.configService.get<string>('GITHUB_USERNAME') || 'vheins';
    const start = Date.now();

    this.logger.log(`► Starting targeted bulk PR sync for ${username}...`);
    
    const allPRs: PullRequest[] = [];
    const scopeActions = [
      { scope: 'authored',         query: `author:${username}`,           label: `authored by ${username}` },
      { scope: 'assigned',         query: `assignee:${username}`,         label: `assigned to ${username}` },
      { scope: 'review-requested', query: `review-requested:${username}`, label: `review-requested ${username}` },
      { scope: 'mentions',         query: `mentions:${username}`,         label: `mentions ${username}` },
    ];

    try {
      this.logger.debug('[CLI] Performing targeted search for all states via gh search prs');
      for (const { scope, query } of scopeActions) {
        // If scope is not in config and it's not the default mentions fallback, skip
        if (!appConfig.prScope.includes(scope) && scope !== 'mentions') continue;
        
        // Search all states, no archived filter to include historical data
        const items = await this.cli.searchPRs(`${query}`);
        
        // Normalize CLI results
        const normalizedItems = items.map(item => ({
          id: item.id, // CLI 'id' is already the node ID string
          github_id: null, // Numeric ID not available in basic search
          number: item.number,
          node_id: item.id,
          title: item.title,
          body: item.body || '',
          state: item.state,
          locked: item.isLocked || false,
          draft: item.isDraft || false,
          repository: { nameWithOwner: item.repository?.nameWithOwner || item.repository },
          url: item.url,
          updatedAt: item.updatedAt,
          createdAt: item.createdAt || item.updatedAt,
          closedAt: item.closedAt || null,
          author: { login: item.author?.login || item.author },
          labels: (item.labels || []).map(l => typeof l === 'string' ? l : l.name)
        }));
        
        allPRs.push(...(normalizedItems as any[] as PullRequest[]));
      }

      // If absolutely nothing found in specific scopes, try targeted mentions/involves
      if (allPRs.length === 0) {
          this.logger.debug('[CLI] No specific scope matches, trying involves filter (all states)');
          const items = await this.cli.searchPRs(`mentions:${username} archived:false`);
          const normalizedItems = items.map(item => ({
            id: item.id,
            github_id: null,
            number: item.number,
            node_id: item.id,
            title: item.title,
            body: item.body || '',
            state: item.state,
            locked: item.isLocked || false,
            draft: item.isDraft || false,
            repository: { nameWithOwner: item.repository?.nameWithOwner || item.repository },
            url: item.url,
            updatedAt: item.updatedAt,
            createdAt: item.createdAt || item.updatedAt,
            closedAt: item.closedAt || null,
            author: { login: item.author?.login || item.author },
            labels: (item.labels || []).map(l => typeof l === 'string' ? l : l.name)
          }));
          allPRs.push(...(normalizedItems as any[] as PullRequest[]));
      }

      if (allPRs.length > 0) {
        this.logger.log(`► Targeted sync found ${allPRs.length} relevant PRs in ${Date.now() - start}ms`);
        return this.processPRs(allPRs);
      }
    } catch (cliError) {
      this.logger.warn(`[CLI] Targeted search failed: ${cliError.message}`);
    }

    if (token) {
      try {
        this.logger.log('► Falling back to REST API discovery (targeted)...');
        const filters = [];
        if (appConfig.prScope.includes('authored')) filters.push(`author:${username}`);
        if (appConfig.prScope.includes('assigned')) filters.push(`assignee:${username}`);
        if (appConfig.prScope.includes('review-requested')) filters.push(`review-requested:${username}`);
        
        const filterStr = filters.length > 0 ? `(${filters.join(' OR ')})` : `involves:${username}`;
        const query = `is:pr archived:false ${filterStr}`; 
        
        let prs: PullRequest[] = [];
        try {
          const result = await this.api.searchPRs(query);
          prs = result.items.map(item => ({
            id: item.node_id,
            github_id: item.id,
            number: item.number,
            node_id: item.node_id,
            title: item.title,
            body: item.body,
            state: item.state,
            locked: item.locked,
            draft: item.draft || false,
            repository: { nameWithOwner: item.repository_url.split('repos/')[1] },
            url: item.html_url,
            updatedAt: item.updated_at,
            createdAt: item.created_at,
            author: { login: item.user?.login || 'unknown', id: item.user?.id },
            labels: (item.labels || []).map(l => typeof l === 'string' ? l : l.name)
          }));
        } catch (e) {
          const simpleResult = await this.api.searchPRs(`is:pr archived:false involves:${username}`);
          prs = simpleResult.items.map(item => ({
            id: item.node_id,
            github_id: item.id,
            number: item.number,
            node_id: item.node_id,
            title: item.title,
            body: item.body,
            state: item.state,
            locked: item.locked,
            draft: item.draft || false,
            repository: { nameWithOwner: item.repository_url.split('repos/')[1] },
            url: item.html_url,
            updatedAt: item.updated_at,
            createdAt: item.created_at,
            author: { login: item.user?.login || 'unknown', id: item.user?.id },
            labels: (item.labels || []).map(l => typeof l === 'string' ? l : l.name)
          }));
        }
        this.logger.log(`► API discovery found ${prs.length} PRs in ${Date.now() - start}ms`);
        return this.processPRs(prs);
      } catch (apiError) {
        this.logger.error(`[API] Targeted discovery failed: ${apiError.message}`);
      }
    }

    this.logger.warn(`► No relevant PRs found for ${username} after ${Date.now() - start}ms`);
    return [];
  }

  /**
   * Fetch open issues
   */
  async fetchOpenIssues(): Promise<Issue[]> {
    this.logger.log('► Syncing issues...');
    const token = this.configService.get<string>('GITHUB_TOKEN');

    if (token) {
      try {
        const result = await this.api.searchIssues('is:issue is:open mentions:@me');
        return result.items.map(item => {
          const repoUrl = item.repository_url;
          const repoPath = repoUrl.split('/repos/')[1];
          return {
            id: item.id,
            number: item.number,
            node_id: item.node_id,
            title: item.title,
            body: item.body,
            state: item.state,
            repository: {
              nameWithOwner: repoPath
            },
            url: item.html_url,
            updatedAt: item.updated_at,
            createdAt: item.created_at,
            author: {
              login: item.user?.login || 'unknown',
              id: item.user?.id
            },
            labels: (item.labels || []).map(l => typeof l === 'string' ? l : l.name)
          };
        });
      } catch (apiError) {
        this.logger.warn(`GitHub API issue fetch failed, falling back to CLI: ${apiError.message}`);
      }
    }

    return this.cli.searchIssues();
  }

  /**
   * Internal helper to deduplicate and filter PR data
   */
  private async processPRs(prs: PullRequest[]): Promise<PullRequest[]> {
    const appConfig = this.config.getAppConfig();
    const uniquePRs = Array.from(new Map(prs.map(pr => [pr.url, pr])).values());
    
    this.logger.log(`► Processing ${uniquePRs.length} unique PRs...`);
    this.logger.debug(`[Sync] Filter criteria - Excluded owners: ${JSON.stringify(appConfig.excludeRepoOwners || [])}`);

    const filteredPRs = uniquePRs.filter(pr => {
      if (!pr.repository?.nameWithOwner) {
        this.logger.debug(`[Sync] Skipping PR #${pr.number}: missing repository nameWithOwner`);
        return false;
      }
      const owner = pr.repository.nameWithOwner.split('/')[0];
      const isExcluded = (appConfig.excludeRepoOwners || []).includes(owner);
      if (isExcluded) {
        this.logger.debug(`[Sync] Filtering out PR #${pr.number}: owner "${owner}" is excluded`);
        return false;
      }
      return true;
    });

    this.logger.log(`► Found ${filteredPRs.length} relevant PRs after filtering by owner.`);
    filteredPRs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return filteredPRs;
  }

  /**
   * Get full details for a single Pull Request
   */
  async getPR(repoName: string, prNumber: number): Promise<PullRequest> {
    return this.getPRDetail(repoName, prNumber);
  }

  /**
   * Get full details for a single Pull Request
   */
  async getPRDetail(repoName: string, prNumber: number): Promise<PullRequest> {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    this.logger.debug(`[Sync] Getting deep PR details for ${repoName}#${prNumber}`);
    
    if (token) {
      const detail = await this.api.getPRDetail(repoName, prNumber);
      return {
        id: detail.node_id,
        github_id: detail.id,
        number: detail.number,
        node_id: detail.node_id,
        title: detail.title,
        body: detail.body,
        state: detail.state,
        locked: detail.locked,
        active_lock_reason: detail.active_lock_reason,
        draft: detail.draft,
        repository: { nameWithOwner: repoName },
        url: detail.html_url,
        diff_url: detail.diff_url,
        patch_url: detail.patch_url,
        updatedAt: detail.updated_at,
        createdAt: detail.created_at,
        closedAt: detail.closed_at,
        mergedAt: detail.merged_at,
        headRefName: detail.head.ref,
        headSha: detail.head.sha,
        baseRefName: detail.base.ref,
        baseSha: detail.base.sha,
        merge_commit_sha: detail.merge_commit_sha,
        merged: detail.merged,
        mergeable: detail.mergeable,
        mergeable_state: detail.mergeable_state,
        mergedBy: detail.merged_by?.login,
        labels: (detail.labels || []).map(l => typeof l === 'string' ? l : l.name),
        requested_reviewers: (detail.requested_reviewers || []).map(r => r.login),
        milestone: detail.milestone?.title,
        auto_merge: detail.auto_merge,
        author: { login: detail.user.login, id: detail.user.id },
        stats: {
          commits: detail.commits,
          additions: detail.additions,
          deletions: detail.deletions,
          changed_files: detail.changed_files,
          comments: detail.comments,
          review_comments: detail.review_comments
        }
      };
    }

    const cliDetail = await this.cli.getPRDetail(repoName, prNumber);
    return {
      id: cliDetail.id, // CLI id is node_id string
      github_id: null,
      number: cliDetail.number,
      node_id: cliDetail.id,
      title: cliDetail.title,
      body: cliDetail.body,
      state: cliDetail.state,
      locked: false,
      draft: cliDetail.isDraft,
      repository: { nameWithOwner: repoName },
      url: cliDetail.url,
      updatedAt: cliDetail.updatedAt,
      createdAt: cliDetail.createdAt,
      author: { login: cliDetail.author?.login || cliDetail.author },
      labels: cliDetail.labels || []
    } as PullRequest;
  }

  /**
   * List pull requests
   */
  async listPRs(repoName: string, params: any = {}): Promise<PullRequest[]> {
    this.logger.log(`[Sync] Listing PRs for repository: ${repoName}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      try {
        const result = await this.api.listPRs(repoName, params);
        return result.map(item => ({
          id: item.node_id,
          github_id: item.id,
          number: item.number,
          node_id: item.node_id,
          title: item.title,
          body: item.body,
          state: item.state,
          locked: item.locked,
          draft: item.draft,
          repository: { nameWithOwner: repoName },
          url: item.html_url,
          updatedAt: item.updated_at,
          createdAt: item.created_at,
          author: { login: item.user.login, id: item.user.id },
          labels: (item.labels || []).map(l => typeof l === 'string' ? l : l.name)
        }));
      } catch (e) {
        this.logger.warn(`API list PRs failed: ${e.message}`);
      }
    }
    return this.cli.searchPRs(`--repo ${repoName} ${params.state ? `--state ${params.state}` : ''}`);
  }

  /**
   * Create a pull request
   */
  async createPR(repoName: string, data: { title: string; head: string; base: string; body?: string; draft?: boolean }): Promise<PullRequest> {
    this.logger.log(`[Sync] Creating PR in ${repoName}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      const result = await this.api.createPR(repoName, data);
      return {
        id: result.node_id,
        github_id: result.id,
        number: result.number,
        node_id: result.node_id,
        title: result.title,
        body: result.body,
        state: result.state,
        locked: result.locked,
        draft: result.draft,
        repository: { nameWithOwner: repoName },
        url: result.html_url,
        updatedAt: result.updated_at,
        createdAt: result.created_at,
        author: { login: result.user.login, id: result.user.id },
        labels: (result.labels || []).map(l => typeof l === 'string' ? l : l.name)
      };
    }
    throw new Error('Create PR via CLI not implemented yet in this service');
  }

  /**
   * Update a pull request
   */
  async updatePR(repoName: string, prNumber: number, data: any): Promise<PullRequest> {
    this.logger.log(`[Sync] Updating PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      const result = await this.api.updatePR(repoName, prNumber, data);
      return {
        id: result.node_id,
        github_id: result.id,
        number: result.number,
        node_id: result.node_id,
        title: result.title,
        body: result.body,
        state: result.state,
        locked: result.locked,
        draft: result.draft,
        repository: { nameWithOwner: repoName },
        url: result.html_url,
        updatedAt: result.updated_at,
        createdAt: result.created_at,
        author: { login: result.user.login, id: result.user.id },
        labels: (result.labels || []).map(l => typeof l === 'string' ? l : l.name)
      };
    }
    throw new Error('Update PR via CLI not implemented');
  }

  /**
   * List PR commits
   */
  async listPRCommits(repoName: string, prNumber: number): Promise<any[]> {
    this.logger.debug(`[Sync] Listing commits for PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      return this.api.listPRCommits(repoName, prNumber);
    }
    return []; 
  }

  /**
   * List PR files
   */
  async listPRFiles(repoName: string, prNumber: number): Promise<any[]> {
    this.logger.debug(`[Sync] Listing files for PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      return this.api.listPRFiles(repoName, prNumber);
    }
    return [];
  }

  /**
   * Check if PR is merged
   */
  async isMerged(repoName: string, prNumber: number): Promise<boolean> {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      return this.api.checkMerged(repoName, prNumber);
    }
    const detail = await this.cli.getPRDetail(repoName, prNumber);
    return detail.state === 'MERGED' || detail.state === 'merged';
  }

  /**
   * Update PR branch
   */
  async updatePRBranch(repoName: string, prNumber: number, expectedHeadSha?: string): Promise<boolean> {
    this.logger.log(`[Sync] Updating branch for PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      try {
        await this.api.updateBranch(repoName, prNumber, expectedHeadSha);
        return true;
      } catch (e) {
        this.logger.warn(`API update branch failed, falling back to CLI: ${e.message}`);
      }
    }
    try {
      await this.cli.updateBranch(repoName, prNumber);
      return true;
    } catch (e) {
      this.logger.error(`Failed to update branch: ${e.message}`);
      return false;
    }
  }

  async listReviews(repoName: string, prNumber: number): Promise<any[]> {
    this.logger.debug(`[Sync] Listing reviews for PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      try {
        return await this.api.listReviews(repoName, prNumber);
      } catch (e) {
        this.logger.warn(`API list reviews failed, falling back to CLI: ${e.message}`);
      }
    }
    return this.cli.listReviews(repoName, prNumber);
  }

  async getReview(repoName: string, prNumber: number, reviewId: number): Promise<any> {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) return this.api.getReview(repoName, prNumber, reviewId);
    const reviews = await this.cli.listReviews(repoName, prNumber);
    return reviews.find(r => r.id === reviewId);
  }

  async updateReview(repoName: string, prNumber: number, reviewId: number, body: string): Promise<boolean> {
    this.logger.log(`[Sync] Updating review ${reviewId} for PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      await this.api.updateReview(repoName, prNumber, reviewId, body);
      return true;
    }
    return false;
  }

  async deleteReview(repoName: string, prNumber: number, reviewId: number): Promise<boolean> {
    this.logger.log(`[Sync] Deleting review ${reviewId} for PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      await this.api.deleteReview(repoName, prNumber, reviewId);
      return true;
    }
    return false;
  }

  async submitReview(repoName: string, prNumber: number, reviewId: number, event: string, body?: string): Promise<boolean> {
    this.logger.log(`[Sync] Submitting review ${reviewId} for PR ${repoName}#${prNumber} as ${event}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      await this.api.submitReview(repoName, prNumber, reviewId, event, body);
      return true;
    }
    return false;
  }

  async dismissReview(repoName: string, prNumber: number, reviewId: number, message: string): Promise<boolean> {
    this.logger.log(`[Sync] Dismissing review ${reviewId} for PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      try {
        await this.api.dismissReview(repoName, prNumber, reviewId, message);
        return true;
      } catch (e) {
        this.logger.warn(`API dismiss review failed, falling back to CLI: ${e.message}`);
      }
    }
    await this.cli.dismissReview(repoName, prNumber, reviewId, message);
    return true;
  }

  async listReviewComments(repoName: string, prNumber: number): Promise<any[]> {
    this.logger.debug(`[Sync] Listing review comments for PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      try {
        return await this.api.listReviewComments(repoName, prNumber);
      } catch (e) {
        this.logger.warn(`API list review comments failed, falling back to CLI: ${e.message}`);
      }
    }
    return this.cli.listReviewComments(repoName, prNumber);
  }

  async listIssueComments(repoName: string, issueNumber: number): Promise<any[]> {
    this.logger.debug(`[Sync] Listing issue comments for ${repoName}#${issueNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      try {
        return await this.api.listIssueComments(repoName, issueNumber);
      } catch (e) {
        this.logger.warn(`API list issue comments failed: ${e.message}`);
        return [];
      }
    }
    return [];
  }

  async createReviewComment(repoName: string, prNumber: number, data: any): Promise<any> {
    this.logger.log(`[Sync] Creating review comment on PR ${repoName}#${prNumber}`);
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) return this.api.createReviewComment(repoName, prNumber, data);
    return null;
  }

  /**
   * Add a review comment to a Pull Request
   */
  async addReview(repoName: string, prNumber: number, body: string, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT'): Promise<boolean> {
    this.logger.log(`[Sync] Adding review to PR ${repoName}#${prNumber} (${event})`);
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
    } catch (cliError) {
      this.logger.error(`GitHub CLI review failed: ${cliError.message}`);
      return false;
    }
  }

  /**
   * Merge a Pull Request
   */
  async mergePR(repoName: string, prNumber: number, method: 'squash' | 'merge' | 'rebase' = 'squash'): Promise<boolean> {
    this.logger.log(`[Sync] Merging PR ${repoName}#${prNumber} using ${method}`);
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
    } catch (cliError) {
      this.logger.error(`GitHub CLI merge failed: ${cliError.message}`);
      return false;
    }
  }

  /**
   * Assign reviewers to a Pull Request
   */
  async assignReviewers(repoName: string, prNumber: number, reviewers: string[] = []): Promise<boolean> {
    if (reviewers.length === 0) return true;
    this.logger.log(`[Sync] Assigning reviewers to PR ${repoName}#${prNumber}: ${reviewers.join(', ')}`);
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
    } catch (cliError) {
      this.logger.error(`GitHub CLI assignment failed: ${cliError.message}`);
      return false;
    }
  }

  async getPRChecks(repoName: string, prNumber: number): Promise<any[]> {
    this.logger.debug(`[Sync] Fetching checks for PR ${repoName}#${prNumber}`);
    try {
      // GitHub API for checks is a bit complex (Check Runs API), 
      // CLI 'pr checks' is very convenient. API implementation can be added if needed.
      return await this.cli.getPRChecks(repoName, prNumber);
    } catch (e) {
      this.logger.error(`Failed to fetch PR checks: ${e.message}`);
      return [];
    }
  }

  async getTestResults(repoName: string, prNumber: number): Promise<any> {
    this.logger.debug(`[Sync] Fetching test results for PR ${repoName}#${prNumber}`);
    const checks = await this.getPRChecks(repoName, prNumber);
    return {
      total: checks.length,
      passed: checks.filter(c => c.conclusion === 'success').length,
      failed: checks.filter(c => c.conclusion === 'failure').length,
      pending: checks.filter(c => c.status !== 'completed').length,
      checks
    };
  }

  async getChangedFiles(repoDir: string, pr: PullRequest): Promise<{ path: string; content: string }[]> {
    this.logger.debug(`[Sync] Getting changed files for PR ${pr.repository.nameWithOwner}#${pr.number}`);
    try {
      const { stdout } = await this.cli.execaVerbose('git', ['diff', '--name-only', `${pr.baseRefName}...${pr.headRefName}`], { cwd: repoDir });
      const filePaths = stdout.split('\n').filter(line => line.trim() !== '');
      
      const changedFiles: { path: string; content: string }[] = [];
      for (const filePath of filePaths) {
        const fullPath = path.join(repoDir, filePath);
        if (await fs.pathExists(fullPath)) {
          const stats = await fs.stat(fullPath);
          if (stats.isFile() && stats.size < 500000) { // Limit 500KB
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
