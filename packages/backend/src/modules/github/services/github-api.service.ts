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
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`GitHub API Error: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  async searchPRs(query: string): Promise<any> {
    return this.fetchApi(`/search/issues?q=${encodeURIComponent(query)}&per_page=100&sort=updated&order=desc`);
  }

  async getPRDetail(repoName: string, prNumber: number): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}`);
  }

  async addReview(repoName: string, prNumber: number, body: string, event: string): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ body, event })
    });
  }

  async mergePR(repoName: string, prNumber: number, method: string): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: method })
    });
  }

  async assignReviewers(repoName: string, prNumber: number, reviewers: string[]): Promise<any> {
    return this.fetchApi(`/repos/${repoName}/issues/${prNumber}/assignees`, {
      method: 'POST',
      body: JSON.stringify({ assignees: reviewers })
    });
  }

  async searchIssues(query: string): Promise<any> {
    return this.fetchApi(`/search/issues?q=${encodeURIComponent(query)}&per_page=100&sort=updated&order=desc`);
  }

  async getRateLimit(): Promise<any> {
    return this.fetchApi('/rate_limit');
  }
}
