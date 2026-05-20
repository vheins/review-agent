import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { RepositoryConfig } from '../../database/entities/repository-config.entity.js';
import { PullRequestService } from './pull-request.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(ReviewMetrics)
    private readonly metricsRepo: Repository<ReviewMetrics>,
    @InjectRepository(RepositoryConfig)
    private readonly configRepo: Repository<RepositoryConfig>,
    private readonly prService: PullRequestService,
  ) {}

  @Get()
  async getSnapshot(@Query('rangeDays') rangeDays: number = 30) {
    const syncedPRs = await this.prService.scanAndSync();
    const activePRs = syncedPRs.filter(pr => !pr.draft && pr.state === 'open');
    const openPRsCount = activePRs.length;
    const blockingPRsCount = await this.prRepo.count({
      where: [
        { status: 'open', mergeable_state: 'dirty' },
        { status: 'open', mergeable_state: 'blocked' },
        { status: 'open', mergeable: false },
      ],
    });
    const reviewQueue = activePRs.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ).slice(0, 10);
    const totalReviews = await this.metricsRepo.count();
    const avgHealth = await this.metricsRepo.average('healthScore') || 0;

    const repositories = await this.configRepo.find();
    
    const configSummaries = repositories.map(repo => ({
      repository: repo.repository,
      mode: repo.reviewMode,
      interval: 600, // Default fallback as it's not in the entity yet
      autoMerge: repo.autoMerge,
      threshold: 80  // Default fallback as it's not in the entity yet
    }));

    return {
      snapshot: {
        overview: {
          openPRs: openPRsCount,
          blockingPRs: blockingPRsCount,
          avgReviewSeconds: 3600,
          slaComplianceRate: 100,
          avgHealthScore: avgHealth,
        },
        metricsOverview: {
          total_reviews: totalReviews,
        },
        reviewQueue,
        recentActivity: [], 
        teamWorkload: [],   
        configSummaries,
        repositories,
        trendData: [],
        approvalByExecutor: [],
        rejectionReasons: [],
      }
    };
  }
}
