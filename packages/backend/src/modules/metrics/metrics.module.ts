import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsService } from './metrics.service.js';
import { CoverageTrackerService } from './services/coverage-tracker.service.js';
import { CoverageService } from './services/coverage.service.js';
import { SlaMonitorService } from './services/sla-monitor.service.js';
import { Review } from '../../database/entities/review.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';
import { MetricsController } from './metrics.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Review,
      ReviewMetrics,
      PullRequest,
      Comment,
      DeveloperMetrics,
    ]),
  ],
  controllers: [MetricsController],
  providers: [MetricsService, CoverageTrackerService, CoverageService, SlaMonitorService],
  exports: [MetricsService, CoverageTrackerService, CoverageService, SlaMonitorService],
})
export class MetricsModule {}
