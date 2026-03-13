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
      const status = response.status;
      const errorText = await response.text();
      let message = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        message = errorJson.message || message;
      } catch (e) {
        message = errorText || message;
      }
      this.logger.error(`GitHub API Error [${status}]: ${message}`);
      throw new Error(`GitHub API Error [${status}]: ${message}`);
    }

    return await response.json();
  }

  async searchPRs(query: string): Promise<any> {
    return this.fetchApi(`/search/issues?q=${encodeURIComponent(query)}&per_page=100&sort=updated&order=desc`);
  }

  async listPRs(repoName: string, params: { state?: 'open' | 'closed' | 'all'; head?: string; base?: string; sort?: 'created' | 'updated' | 'popularity' | 'long-running'; direction?: 'asc' | 'desc'; per_page?: number; page?: number } = {}): Promise<any> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString());
    });
    const query = searchParams.toString();
    return this.fetchApi(`/repos/${repoName}/pulls${query ? `?${query}` : ''}`);
  }

  async createPR(repoName: string, data: { title: string; head: string; base: string; body?: string; maintainer_can_modify?: boolean; draft?: boolean }): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getPRDetail(repoName: string, prNumber: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}`);
  }

  async updatePR(repoName: string, prNumber: number, data: { title?: string; body?: string; state?: 'open' | 'closed'; base?: string; maintainer_can_modify?: boolean }): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async listPRCommits(repoName: string, prNumber: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/commits`);
  }

  async listPRFiles(repoName: string, prNumber: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/files`);
  }

  async checkMerged(repoName: string, prNumber: number): Promise<boolean> {
    try {
      await this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/merge`);
      return true;
    } catch (e) {
      return false;
    }
  }

  async mergePR(repoName: string, prNumber: number, method: string): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: method })
    });
  }

  async updateBranch(repoName: string, prNumber: number, expectedHeadSha?: string): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/update-branch`, {
      method: 'PUT',
      body: expectedHeadSha ? JSON.stringify({ expected_head_sha: expectedHeadSha }) : undefined
    });
  }

  async listReviews(repoName: string, prNumber: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews`);
  }

  async getReview(repoName: string, prNumber: number, reviewId: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}`);
  }

  async addReview(repoName: string, prNumber: number, body: string, event: string): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ body, event })
    });
  }

  async updateReview(repoName: string, prNumber: number, reviewId: number, body: string): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify({ body })
    });
  }

  async deleteReview(repoName: string, prNumber: number, reviewId: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}`, {
      method: 'DELETE'
    });
  }

  async submitReview(repoName: string, prNumber: number, reviewId: number, event: string, body?: string): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}/events`, {
      method: 'POST',
      body: JSON.stringify({ event, body })
    });
  }

  async dismissReview(repoName: string, prNumber: number, reviewId: number, message: string): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}/dismissals`, {
      method: 'PUT',
      body: JSON.stringify({ message })
    });
  }

  async listReviewComments(repoName: string, prNumber: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/comments`);
  }

  async getReviewComment(repoName: string, commentId: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/comments/${commentId}`);
  }

  async createReviewComment(repoName: string, prNumber: number, data: { body: string; commit_id: string; path: string; line: number; side?: string; start_line?: number; start_side?: number }): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateReviewComment(repoName: string, commentId: number, body: string): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body })
    });
  }

  async deleteReviewComment(repoName: string, commentId: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/comments/${commentId}`, {
      method: 'DELETE'
    });
  }

  async assignReviewers(repoName: string, prNumber: number, reviewers: string[]): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/requested_reviewers`, {
      method: 'POST',
      body: JSON.stringify({ reviewers })
    });
  }

  async removeReviewers(repoName: string, prNumber: number, reviewers: string[]): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/requested_reviewers`, {
      method: 'DELETE',
      body: JSON.stringify({ reviewers })
    });
  }

  async searchIssues(query: string): Promise<any> {
    return this.fetchApi(`/search/issues?q=${encodeURIComponent(query)}&per_page=100&sort=updated&order=desc`);
  }

  async getRateLimit(): Promise<any> {
    return this.fetchApi('/rate_limit');
  }
}
