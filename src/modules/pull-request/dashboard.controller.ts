import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { RepositoryConfig } from '../../database/entities/repository-config.entity.js';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(ReviewMetrics)
    private readonly metricsRepo: Repository<ReviewMetrics>,
    @InjectRepository(RepositoryConfig)
    private readonly configRepo: Repository<RepositoryConfig>,
  ) {}

  @Get()
  async getSnapshot(@Query('rangeDays') rangeDays: number = 30) {
    const openPRs = await this.prRepo.count({ where: { status: 'open' } });
    const totalReviews = await this.metricsRepo.count();
    const avgHealth = await this.metricsRepo.average('healthScore') || 0;
    
    // Mocking some fields that are expected by renderer.js but not yet fully implemented
    return {
      snapshot: {
        overview: {
          openPRs,
          blockingPRs: 0,
          avgReviewSeconds: 3600,
          slaComplianceRate: 100,
          avgHealthScore: avgHealth,
        },
        metricsOverview: {
          total_reviews: totalReviews,
        },
        reviewQueue: [],
        recentActivity: [],
        teamWorkload: [],
        configSummaries: [],
        repositories: await this.configRepo.find(),
        trendData: [],
        approvalByExecutor: [],
        rejectionReasons: [],
      }
    };
  }
}
