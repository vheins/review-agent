import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest as PullRequestEntity } from '../../database/entities/pull-request.entity.js';
import { GitHubClientService, PullRequest as GitHubPR } from '../github/github.service.js';
import { ReviewEngineService } from '../review/review-engine.service.js';
import { AiExecutorService } from '../ai/ai-executor.service.js';

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
  ) {}

  /**
   * List all pull requests from database
   */
  async findAll(): Promise<PullRequestEntity[]> {
    return this.prRepository.find({
      order: { updatedAt: 'DESC' },
      relations: ['reviews'],
    });
  }

  /**
   * Find a single pull request by number and repository
   */
  async findOne(repoName: string, number: number): Promise<PullRequestEntity> {
    const pr = await this.prRepository.findOne({
      where: { repository: repoName, number },
      relations: ['reviews', 'reviews.comments', 'reviews.metrics'],
    });

    if (!pr) {
      throw new NotFoundException(`Pull Request #${number} in ${repoName} not found`);
    }

    return pr;
  }

  /**
   * Scan GitHub for new pull requests and update database with Lead Insights
   */
  async scanAndSync(): Promise<GitHubPR[]> {
    this.logger.log('Starting scanAndSync for all configured PRs...');
    const prs = await this.github.fetchOpenPRs();
    
    for (const pr of prs) {
      try {
        let prEntity = await this.prRepository.findOne({ 
          where: { number: pr.number, repository: pr.repository.nameWithOwner } 
        });

        const isNew = !prEntity;
        
        if (isNew) {
          this.logger.log(`New PR detected: ${pr.repository.nameWithOwner}#${pr.number}. Saving to database...`);
          
          prEntity = this.prRepository.create({
            number: pr.number,
            repository: pr.repository.nameWithOwner,
            title: pr.title,
            url: pr.url,
            status: pr.state.toLowerCase(),
            author: pr.author?.login || 'unknown',
            branch: pr.headRefName || 'unknown',
            baseBranch: pr.baseRefName || 'unknown',
            isDraft: false,
            labels: [],
            lead_summary: '', // To be generated later or on-demand
            risk_score: 0,
            impact_score: 0,
            pr_category: 'uncategorized',
          });
          
          await this.prRepository.save(prEntity);
          this.logger.log(`Saved new PR: ${pr.repository.nameWithOwner}#${pr.number}`);
        } else {
          // Update existing PR metadata
          prEntity.title = pr.title;
          prEntity.status = pr.state.toLowerCase();
          prEntity.updatedAt = new Date();
          await this.prRepository.save(prEntity);
        }
      } catch (e) {
        this.logger.error(`Failed to sync PR #${pr.number}: ${e.message}`);
      }
    }
    
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
}
