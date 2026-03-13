import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../../../config/app-config.service.js';

@Injectable()
export class GithubApiService {
  private readonly logger = new Logger(GithubApiService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Helper for GitHub API requests
   */
  async fetchApi(endpoint: string, options: any = {}) {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (!token) {
      throw new Error('GITHUB_TOKEN is not configured');
    }

    this.logger.debug(`[API] ▶ ${options.method || 'GET'} ${endpoint}`);
    const start = Date.now();

    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'PR-Review-Agent',
        ...options.headers,
      },
    });

    const duration = Date.now() - start;

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      let message = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        message = errorJson.message || message;
      } catch (e) {
        message = errorText || message;
      }
      this.logger.error(`[API] ✖ Error [${status}] after ${duration}ms: ${message}`);
      throw new Error(`GitHub API Error [${status}]: ${message}`);
    }

    this.logger.debug(`[API] ✔ Completed in ${duration}ms`);
    return await response.json();
  }

  async searchPRs(query: string): Promise<any> {
    this.logger.log(`[API] Searching PRs: ${query}`);
    return this.fetchApi(`/search/issues?q=${encodeURIComponent(query)}&per_page=100&sort=updated&order=desc`);
  }

  async listPRs(repoName: string, params: { state?: 'open' | 'closed' | 'all'; head?: string; base?: string; sort?: 'created' | 'updated' | 'popularity' | 'long-running'; direction?: 'asc' | 'desc'; per_page?: number; page?: number } = {}): Promise<any> {
    this.logger.log(`[API] Listing PRs for ${repoName}`);
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString());
    });
    const query = searchParams.toString();
    return this.fetchApi(`/repos/${repoName}/pulls${query ? `?${query}` : ''}`);
  }

  async createPR(repoName: string, data: { title: string; head: string; base: string; body?: string; maintainer_can_modify?: boolean; draft?: boolean }): Promise<any> {
    this.logger.log(`[API] Creating PR in ${repoName}: ${data.title}`);
    return this.fetchApi(`/repos/${repoName}/pulls`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getPR(repoName: string, prNumber: number): Promise<any> {
    this.logger.debug(`[API] Getting PR detail: ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}`);
  }

  async getPRDetail(repoName: string, prNumber: number): Promise<any> {
    return this.getPR(repoName, prNumber);
  }

  async updatePR(repoName: string, prNumber: number, data: { title?: string; body?: string; state?: 'open' | 'closed'; base?: string; maintainer_can_modify?: boolean }): Promise<any> {
    this.logger.log(`[API] Updating PR ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async listPRCommits(repoName: string, prNumber: number): Promise<any> {
    this.logger.debug(`[API] Listing commits for ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/commits`);
  }

  async listPRFiles(repoName: string, prNumber: number): Promise<any> {
    this.logger.debug(`[API] Listing files for ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/files`);
  }

  async checkMerged(repoName: string, prNumber: number): Promise<boolean> {
    this.logger.debug(`[API] Checking merge status for ${repoName}#${prNumber}`);
    try {
      await this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/merge`);
      return true;
    } catch (e) {
      return false;
    }
  }

  async mergePR(repoName: string, prNumber: number, method: string): Promise<any> {
    this.logger.log(`[API] Merging PR ${repoName}#${prNumber} via ${method}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: method })
    });
  }

  async updateBranch(repoName: string, prNumber: number, expectedHeadSha?: string): Promise<any> {
    this.logger.log(`[API] Updating branch for ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/update-branch`, {
      method: 'PUT',
      body: expectedHeadSha ? JSON.stringify({ expected_head_sha: expectedHeadSha }) : undefined
    });
  }

  async listReviews(repoName: string, prNumber: number): Promise<any> {
    this.logger.debug(`[API] Listing reviews for ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews`);
  }

  async getReview(repoName: string, prNumber: number, reviewId: number): Promise<any> {
    this.logger.debug(`[API] Getting review ${reviewId} for ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}`);
  }

  async addReview(repoName: string, prNumber: number, body: string, event: string): Promise<any> {
    this.logger.log(`[API] Adding ${event} review to ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ body, event })
    });
  }

  async updateReview(repoName: string, prNumber: number, reviewId: number, body: string): Promise<any> {
    this.logger.log(`[API] Updating review ${reviewId} for ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify({ body })
    });
  }

  async deleteReview(repoName: string, prNumber: number, reviewId: number): Promise<any> {
    this.logger.log(`[API] Deleting review ${reviewId} for ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}`, {
      method: 'DELETE'
    });
  }

  async submitReview(repoName: string, prNumber: number, reviewId: number, event: string, body?: string): Promise<any> {
    this.logger.log(`[API] Submitting review ${reviewId} for ${repoName}#${prNumber} as ${event}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}/events`, {
      method: 'POST',
      body: JSON.stringify({ event, body })
    });
  }

  async dismissReview(repoName: string, prNumber: number, reviewId: number, message: string): Promise<any> {
    this.logger.log(`[API] Dismissing review ${reviewId} for ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}/dismissals`, {
      method: 'PUT',
      body: JSON.stringify({ message })
    });
  }

  async listReviewComments(repoName: string, prNumber: number): Promise<any> {
    this.logger.debug(`[API] Listing review comments for ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/comments`);
  }

  async getReviewComment(repoName: string, commentId: number): Promise<any> {
    this.logger.debug(`[API] Getting review comment ${commentId}`);
    return this.fetchApi(`/repos/${repoName}/pulls/comments/${commentId}`);
  }

  async createReviewComment(repoName: string, prNumber: number, data: any): Promise<any> {
    this.logger.log(`[API] Creating review comment on ${repoName}#${prNumber}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateReviewComment(repoName: string, commentId: number, body: string): Promise<any> {
    this.logger.log(`[API] Updating review comment ${commentId}`);
    return this.fetchApi(`/repos/${repoName}/pulls/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body })
    });
  }

  async deleteReviewComment(repoName: string, commentId: number): Promise<any> {
    this.logger.log(`[API] Deleting review comment ${commentId}`);
    return this.fetchApi(`/repos/${repoName}/pulls/comments/${commentId}`, {
      method: 'DELETE'
    });
  }

  async assignReviewers(repoName: string, prNumber: number, reviewers: string[]): Promise<any> {
    this.logger.log(`[API] Assigning reviewers to ${repoName}#${prNumber}: ${reviewers.join(', ')}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/requested_reviewers`, {
      method: 'POST',
      body: JSON.stringify({ reviewers })
    });
  }

  async removeReviewers(repoName: string, prNumber: number, reviewers: string[]): Promise<any> {
    this.logger.log(`[API] Removing reviewers from ${repoName}#${prNumber}: ${reviewers.join(', ')}`);
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/requested_reviewers`, {
      method: 'DELETE',
      body: JSON.stringify({ reviewers })
    });
  }

  async searchIssues(query: string): Promise<any> {
    this.logger.log(`[API] Searching issues: ${query}`);
    return this.fetchApi(`/search/issues?q=${encodeURIComponent(query)}&per_page=100&sort=updated&order=desc`);
  }

  async getRateLimit(): Promise<any> {
    this.logger.debug('[API] Checking rate limits');
    return this.fetchApi('/rate_limit');
  }
}
