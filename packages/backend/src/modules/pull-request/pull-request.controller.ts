import { Controller, Get, Post, Param, Query, ParseIntPipe, Body } from '@nestjs/common';
import { PullRequestService } from './pull-request.service.js';
import { GitHubClientService } from '../github/github.service.js';
import { sanitizeHtml } from '../../common/utils/sanitization.util.js';

@Controller('prs')
export class PullRequestController {
  constructor(
    private readonly prService: PullRequestService,
    private readonly github: GitHubClientService
  ) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('repository') repository?: string,
    @Query('author') author?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    return this.prService.findAll({ page: pageNum, limit: limitNum, status, repository, author, search });
  }

  @Get('filters')
  async getFilters() {
    return this.prService.getFilterOptions();
  }

  @Get('scan')
  async scan() {
    return this.prService.scanAndSync();
  }

  @Post()
  async create(@Body() data: any) {
    const { repository, ...prData } = data;
    const repoName = sanitizeHtml(repository).replace('-', '/');
    return this.prService.createPR(repoName, prData);
  }

  @Get('id/:id')
  async findById(@Param('id') id: string) {
    const pr = await this.prService.findOne(id);
    // Trigger an update from GitHub to ensure data is fresh
    try {
      const githubPr = await this.prService.getGithubPR(pr.repository, pr.number);
      if (githubPr) {
        // Sync the fresh data back to our entity
        pr.title = githubPr.title;
        pr.body = githubPr.body;
        pr.state = githubPr.state;
        pr.status = githubPr.state?.toLowerCase() || pr.status;
        pr.locked = githubPr.locked || false;
        pr.active_lock_reason = githubPr.active_lock_reason || null;
        pr.isDraft = githubPr.draft || false;
        pr.url = githubPr.url;
        pr.diff_url = githubPr.diff_url || null;
        pr.patch_url = githubPr.patch_url || null;
        
        pr.updatedAt = new Date(githubPr.updatedAt || githubPr.updated_at || pr.updatedAt);
        if (githubPr.createdAt || githubPr.created_at) {
            pr.createdAt = new Date(githubPr.createdAt || githubPr.created_at);
        }
        pr.closed_at = (githubPr.closedAt || githubPr.closed_at) ? new Date(githubPr.closedAt || githubPr.closed_at) : null;
        pr.merged_at = (githubPr.mergedAt || githubPr.merged_at) ? new Date(githubPr.mergedAt || githubPr.merged_at) : null;
        
        pr.branch = githubPr.headRefName || pr.branch;
        pr.head_sha = githubPr.headSha || pr.head_sha;
        pr.baseBranch = githubPr.baseRefName || pr.baseBranch;
        pr.base_sha = githubPr.baseSha || pr.base_sha;
        pr.merge_commit_sha = githubPr.merge_commit_sha || null;
        pr.merged = githubPr.merged || false;
        if (githubPr.mergeable !== undefined) pr.mergeable = githubPr.mergeable;
        pr.mergeable_state = githubPr.mergeable_state || pr.mergeable_state;
        pr.merged_by = githubPr.mergedBy || pr.merged_by;
        pr.labels = githubPr.labels || pr.labels;
        pr.requested_reviewers = githubPr.requested_reviewers || pr.requested_reviewers;
        pr.milestone = githubPr.milestone || pr.milestone;
        pr.auto_merge = githubPr.auto_merge || pr.auto_merge;
        
        if (githubPr.stats) {
          pr.commits_count = githubPr.stats.commits ?? pr.commits_count;
          pr.additions = githubPr.stats.additions ?? pr.additions;
          pr.deletions = githubPr.stats.deletions ?? pr.deletions;
          pr.changed_files = githubPr.stats.changed_files ?? pr.changed_files;
          pr.comments_count = githubPr.stats.comments ?? pr.comments_count;
          pr.review_comments_count = githubPr.stats.review_comments ?? pr.review_comments_count;
        }

        if (githubPr.author) {
          pr.author = githubPr.author.login || pr.author;
          pr.author_id = githubPr.author.id || pr.author_id;
        }
        
        // Save the updated entity
        await (this.prService as any).prRepository.save(pr);
      }
    let githubConversations: any[] = [];
    let latestOutcome: string | null = null;
    
    try {
      if (pr.repository && pr.number) {
        // Fetch both reviews and issue comments concurrently
        const [reviews, issueComments] = await Promise.all([
          this.prService.listReviews(pr.repository, pr.number).catch(() => []),
          this.github.listIssueComments(pr.repository, pr.number).catch(() => [])
        ]);

        // Map formal reviews
        const reviewEvents = (reviews || []).map((r: any) => ({
          id: `review-${r.id}`,
          type: 'review',
          author: r.user?.login || 'unknown',
          state: r.state,
          body: r.body || '',
          url: r.html_url,
          createdAt: r.submitted_at || r.created_at,
          updatedAt: r.updated_at || r.submitted_at || r.created_at
        }));

        // Keep track of the latest significant review state
        const significantReviews = reviewEvents
          .filter(r => ['CHANGES_REQUESTED', 'APPROVED'].includes(r.state?.toUpperCase()))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        if (significantReviews.length > 0) {
          latestOutcome = significantReviews[0].state.toLowerCase();
        }

        // Map general comments
        const commentEvents = (issueComments || []).map((c: any) => ({
          id: `comment-${c.id}`,
          type: 'comment',
          author: c.user?.login || 'unknown',
          state: 'COMMENTED',
          body: c.body || '',
          url: c.html_url,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }));

        // Combine and sort chronologically
        githubConversations = [...reviewEvents, ...commentEvents].sort((a, b) => {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
      }
    } catch (e) {
      console.warn(`[Sync] Failed to fetch conversations for PR ${pr.id}: ${e.message}`);
    }
    
    return { success: true, data: pr, github_conversations: githubConversations, latest_outcome: latestOutcome };
  }

  @Get('id/:id/health')
  async getHealthById(@Param('id') id: string) {
    return this.prService.calculateHealth(id);
  }

  @Get('id/:id/commits')
  async getCommitsById(@Param('id') id: string) {
    const pr = await this.prService.findOne(id);
    return this.prService.listCommits(pr.repository, pr.number);
  }

  @Get('id/:id/files')
  async getFilesById(@Param('id') id: string) {
    const pr = await this.prService.findOne(id);
    return this.prService.listFiles(pr.repository, pr.number);
  }

  @Get('id/:id/history')
  async getHistoryById(@Param('id') id: string) {
    const pr = await this.prService.findOne(id);
    return this.prService.getHistory(pr.repository, pr.number);
  }

  @Get(':repo/:number')
  async findOne(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace(':', '/');
    return this.prService.findOne(repoName, number);
  }

  @Post(':repo/:number')
  async update(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
    @Body() data: any
  ) {
    const repoName = sanitizeHtml(repo).replace(':', '/');
    return this.prService.updatePR(repoName, number, data);
  }

  @Get(':repo/:number/commits')
  async getCommits(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace(':', '/');
    return this.prService.listCommits(repoName, number);
  }

  @Get(':repo/:number/files')
  async getFiles(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace(':', '/');
    return this.prService.listFiles(repoName, number);
  }

  @Post(':repo/:number/update-branch')
  async updateBranch(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
    @Body('expected_head_sha') expectedHeadSha?: string
  ) {
    const repoName = sanitizeHtml(repo).replace(':', '/');
    return this.prService.updateBranch(repoName, number, expectedHeadSha);
  }

  @Post(':repo/:number/review')
  async review(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace(':', '/');
    const success = await this.prService.triggerReview(repoName, number);
    return { success };
  }

  @Get(':repo/:number/health')
  async getHealth(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace(':', '/');
    return this.prService.calculateHealth(repoName, number);
  }

  @Get(':repo/:number/history')
  async getHistory(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace(':', '/');
    return this.prService.getHistory(repoName, number);
  }
}
