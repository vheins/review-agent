import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest as PullRequestEntity } from '../../database/entities/pull-request.entity.js';
import { GitHubClientService, PullRequest as GitHubPR } from '../github/github.service.js';
import { ReviewEngineService } from '../review/review-engine.service.js';

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
   * Scan GitHub for new pull requests and update database
   */
  async scanAndSync(): Promise<GitHubPR[]> {
    const prs = await this.github.fetchOpenPRs();
    // In a real app, we would update the database here too
    // For now we just return them
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
