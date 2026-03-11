import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';
import { MetricsService } from './metrics.service.js';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    @InjectRepository(ReviewMetrics)
    private readonly reviewMetricsRepo: Repository<ReviewMetrics>,
    @InjectRepository(DeveloperMetrics)
    private readonly devMetricsRepo: Repository<DeveloperMetrics>,
  ) {}

  @Get('overview')
  async getOverview() {
    const totalReviews = await this.reviewMetricsRepo.count();
    const avgHealth = await this.reviewMetricsRepo.average('healthScore');
    
    return {
      totalReviews,
      averageHealthScore: avgHealth || 0,
    };
  }

  @Get('pr/:number')
  async getPrMetrics(@Param('number', ParseIntPipe) number: number) {
    // In a real app we'd join with pull_requests table
    return this.reviewMetricsRepo.find({
      where: { review: { prNumber: number } },
      relations: ['review'],
    });
  }

  @Get('developer/:username')
  async getDeveloperMetrics(@Param('username') username: string) {
    return this.devMetricsRepo.findOne({ where: { username } });
  }
}
