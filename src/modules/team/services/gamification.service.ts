import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeveloperMetrics } from '../../../database/entities/developer-metrics.entity.js';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectRepository(DeveloperMetrics)
    private readonly devMetricsRepo: Repository<DeveloperMetrics>,
  ) {}

  async awardPoints(developerId: string, points: number, reason: string): Promise<void> {
    this.logger.log(`Awarding ${points} points to ${developerId} for: ${reason}`);
    
    let metrics = await this.devMetricsRepo.findOne({ where: { username: developerId } });
    if (!metrics) {
      metrics = this.devMetricsRepo.create({
        username: developerId,
        rankingPoints: points,
        reviewedPrs: 0,
        totalPrs: 0,
        averageHealthScore: 0,
        averageQualityScore: 0,
        averageReviewTime: 0,
        issuesFound: { bugs: 0, security: 0, performance: 0, maintainability: 0 },
      });
    } else {
      metrics.rankingPoints += points;
    }

    await this.devMetricsRepo.save(metrics);
  }
}
