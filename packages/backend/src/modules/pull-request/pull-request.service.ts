import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest as PullRequestEntity } from '../../database/entities/pull-request.entity.js';
import { GitHubClientService, PullRequest as GitHubPR } from '../github/github.service.js';
import { ReviewEngineService } from '../review/review-engine.service.js';
import { AiExecutorService } from '../ai/ai-executor.service.js';
import { HealthScoreService } from '../metrics/services/health-score.service.js';

/**
 * PullRequestService - Service for managing Pull Request business logic
 */
@Injectable()
export class PullRequestService {
  private readonly logger = new Logger(PullRequestService.name);

  constructor(
    @InjectRepository(PullRequestEntity)
    private readonly prRepository: Repository<PullRequestEntity>,
    private readonly github: GitHubClientService,
    private readonly reviewEngine: ReviewEngineService,
    private readonly ai: AiExecutorService,
    private readonly healthScoreService: HealthScoreService,
  ) {}

  /**
   * List all pull requests from database with optional filtering
   */
  async findAll(options: { page?: number, limit?: number, status?: string, repository?: string, author?: string, search?: string }) {
    const { page = 1, limit = 10, status, repository, author, search } = options;
    const queryBuilder = this.prRepository.createQueryBuilder('pr')
      .leftJoinAndSelect('pr.reviews', 'reviews')
      .orderBy('pr.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) queryBuilder.andWhere('pr.status = :status', { status });
    if (repository) queryBuilder.andWhere('pr.repository = :repository', { repository });
    if (author) queryBuilder.andWhere('pr.author = :author', { author });
    if (search) {
      queryBuilder.andWhere('(pr.title LIKE :search OR pr.repository LIKE :search OR pr.author LIKE :search OR pr.body LIKE :search)', { search: `%${search}%` });
    }

    const [prs, total] = await queryBuilder.getManyAndCount();

    return {
      data: prs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      }
    };
  }

  /**
   * Get unique authors and repositories for filtering dropdowns
   */
  async getFilterOptions() {
    const authorsResult = await this.prRepository.createQueryBuilder('pr')
      .select('pr.author', 'author')
      .distinct(true)
      .where('pr.author IS NOT NULL')
      .orderBy('pr.author', 'ASC')
      .getRawMany();

    const reposResult = await this.prRepository.createQueryBuilder('pr')
      .select('pr.repository', 'repository')
      .distinct(true)
      .where('pr.repository IS NOT NULL')
      .orderBy('pr.repository', 'ASC')
      .getRawMany();

    return {
      authors: authorsResult.map(res => res.author),
      repositories: reposResult.map(res => res.repository)
    };
  }

  /**
   * Find a pull request by ID or by repository and number
   */
  async findOne(repoNameOrId: string | number, number?: number): Promise<PullRequestEntity> {
    let pr: PullRequestEntity | null = null;

    if (!number) {
      // Find by internal unique ID (string Node ID or numeric Database ID)
      pr = await this.prRepository.findOne({
        where: [
          { id: String(repoNameOrId) },
          { node_id: String(repoNameOrId) },
          { github_id: typeof repoNameOrId === 'number' ? repoNameOrId : -1 }
        ],
        relations: ['reviews', 'reviews.comments', 'reviews.metrics'],
      });
    } else if (typeof repoNameOrId === 'string' && number) {
      // Find by repository name and number
      pr = await this.prRepository.findOne({
        where: { repository: repoNameOrId, number },
        relations: ['reviews', 'reviews.comments', 'reviews.metrics'],
      });
    }

    if (!pr) {
      const identifier = number ? `${repoNameOrId}#${number}` : `ID ${repoNameOrId}`;
      throw new NotFoundException(`Pull Request ${identifier} not found`);
    }

    return pr;
  }

  /**
   * Get fresh data from GitHub for a specific PR
   */
  async getGithubPR(repoName: string, prNumber: number): Promise<any> {
    return this.github.getPR(repoName, prNumber);
  }

  async createPR(repoName: string, data: any) {
    return this.github.createPR(repoName, data);
  }

  async updatePR(repoName: string, number: number, data: any) {
    return this.github.updatePR(repoName, number, data);
  }

  async listCommits(repoName: string, number: number) {
    return this.github.listPRCommits(repoName, number);
  }

  async listFiles(repoName: string, number: number) {
    return this.github.listPRFiles(repoName, number);
  }

  async updateBranch(repoName: string, number: number, expectedHeadSha?: string) {
    return this.github.updatePRBranch(repoName, number, expectedHeadSha);
  }

  async calculateElapsedTime(repoName: string, number: number) {
    const pr = await this.findOne(repoName, number);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - pr.createdAt.getTime()) / 1000);

    return {
      repository: repoName,
      number,
      status: pr.status,
      elapsedSeconds,
      createdAt: pr.createdAt
    };
  }

  async calculateTimeInCurrentStatus(repoName: string, number: number) {
    const pr = await this.findOne(repoName, number);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - pr.updatedAt.getTime()) / 1000);

    return {
      repository: repoName,
      number,
      status: pr.status,
      timeInStatusSeconds: elapsedSeconds,
      statusSince: pr.updatedAt
    };
  }

  /**
   * Scan GitHub for new pull requests and update database with Lead Insights
   */
  async scanAndSync(): Promise<GitHubPR[]> {
    this.logger.log('Fetching PRs from GitHub...');
    const prs = await this.github.fetchOpenPRs();
    this.logger.log(`Starting high-speed bulk scanAndSync for ${prs.length} discovered PRs...`);
    const start = Date.now();
    let savedCount = 0;
    let skippedCount = 0;
    
    for (const pr of prs) {
      try {
        let prEntity: PullRequestEntity | null = null;
        
        if (pr.id) {
          prEntity = await this.prRepository.findOne({ 
            where: { id: pr.id } 
          });
        }
        
        if (!prEntity) {
          prEntity = await this.prRepository.findOne({
            where: { number: pr.number, repository: pr.repository.nameWithOwner }
          });
        }

        const isNew = !prEntity;
        const hasChanged = !isNew && new Date(pr.updatedAt).getTime() > prEntity.updatedAt.getTime();
        
        // Retroactive Enrichment: Force update if existing record is missing critical fields
        const needsSchemaCatchup = !isNew && (!prEntity.body && pr.body);

        if (!isNew && !hasChanged && !needsSchemaCatchup) {
          skippedCount++;
          continue;
        }

        if (isNew) {
          this.logger.debug(`[Sync] New PR detected: ${pr.repository.nameWithOwner}#${pr.number}`);
          prEntity = new PullRequestEntity();
        } else {
          this.logger.debug(`[Sync] ${needsSchemaCatchup ? 'Enriching' : 'Updating'} PR: ${pr.repository.nameWithOwner}#${pr.number}`);
        }

        // Map ONLY fields available in bulk CLI search result
        prEntity.id = pr.id;
        prEntity.github_id = pr.github_id;
        prEntity.number = pr.number;
        prEntity.node_id = pr.node_id;
        prEntity.title = pr.title;
        prEntity.author = pr.author.login;
        prEntity.author_id = pr.author.id || null;
        prEntity.repository = pr.repository.nameWithOwner;
        prEntity.body = pr.body;
        prEntity.state = pr.state;
        prEntity.status = pr.state.toLowerCase();
        prEntity.locked = pr.locked;
        prEntity.active_lock_reason = pr.active_lock_reason || null;
        prEntity.isDraft = pr.draft;
        prEntity.url = pr.url;
        
        // Fields NOT available in bulk search results get defaults
        // These will be enriched on-demand during single-PR fetch
        prEntity.branch = pr.headRefName || prEntity.branch || 'unknown';
        prEntity.baseBranch = pr.baseRefName || prEntity.baseBranch || 'unknown';
        prEntity.head_sha = pr.headSha || prEntity.head_sha || '';
        prEntity.base_sha = pr.baseSha || prEntity.base_sha || '';
        
        prEntity.createdAt = new Date(pr.createdAt);
        prEntity.updatedAt = new Date(pr.updatedAt);
        prEntity.closed_at = pr.closedAt ? new Date(pr.closedAt) : (prEntity.closed_at || null);
        prEntity.merged_at = pr.mergedAt ? new Date(pr.mergedAt) : (prEntity.merged_at || null);
        
        prEntity.labels = pr.labels;
        
        if (isNew) {
          prEntity.lead_summary = '';
          prEntity.risk_score = 0;
          prEntity.impact_score = 0;
          prEntity.priority_score = 0;
          prEntity.pr_category = 'uncategorized';
        }
        
        await this.prRepository.save(prEntity);
        savedCount++;
      } catch (e) {
        this.logger.error(`Failed to bulk sync PR #${pr.number}: ${e.message}`);
      }
    }
    
    this.logger.log(`► scanAndSync completed in ${Date.now() - start}ms. Saved: ${savedCount}, Skipped: ${skippedCount}`);
    return prs;
  }

  /**
   * Trigger a manual review for a PR
   */
  async triggerReview(repoName: string, number: number): Promise<boolean> {
    const prs = await this.github.fetchOpenPRs();
    const pr = prs.find(p => p.number === number && p.repository.nameWithOwner === repoName);
    
    if (!pr) {
      throw new NotFoundException(`PR #${number} not found in open PRs for ${repoName}`);
    }

    return this.reviewEngine.reviewPullRequest(pr);
  }

  async calculateHealth(repoNameOrId: string | number, number?: number) {
    const pr = await this.findOne(repoNameOrId, number);
    return this.healthScoreService.calculatePRHealthScore(pr.number, pr.repository);
  }

  async getHistory(repoName: string, number: number) {
    const pr = await this.findOne(repoName, number);
    return pr.reviews;
  }
}
