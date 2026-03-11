import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeveloperMetrics } from '../../../database/entities/developer-metrics.entity.js';
import { PullRequest } from '../../../database/entities/pull-request.entity.js';
import { Review } from '../../../database/entities/review.entity.js';
import { MetricsService } from '../../metrics/metrics.service.js';

@Injectable()
export class DeveloperDashboardService {
  private readonly logger = new Logger(DeveloperDashboardService.name);

  constructor(
    @InjectRepository(DeveloperMetrics)
    private readonly devMetricsRepo: Repository<DeveloperMetrics>,
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    private readonly metricsService: MetricsService,
  ) {}

  async getDashboardData(developerId: string) {
    const metrics = await this.devMetricsRepo.findOne({ where: { developerId } });
    const pendingPRs = await this.prRepo.find({
      where: { author: developerId, status: 'open' },
      order: { updatedAt: 'DESC' },
    });

    const recentReviews = await this.reviewRepo.find({
      where: { pullRequest: { author: developerId } },
      order: { startedAt: 'DESC' },
      take: 5,
      relations: ['pullRequest', 'metrics'],
    });

    return {
      developerId,
      metrics: metrics || {
        totalPrsReviewed: 0,
        averageHealthScore: 0,
        rankingPoints: 0,
      },
      pendingPRs,
      recentReviews,
      summary: {
        totalPending: pendingPRs.length,
        avgHealthScore: metrics ? metrics.averageHealthScore : 0,
      },
    };
  }
}
