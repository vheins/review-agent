import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsService } from './metrics.service.js';
import { CoverageTrackerService } from './services/coverage-tracker.service.js';
import { CoverageService } from './services/coverage.service.js';
import { SLAMonitorService } from './services/sla-monitor.service.js';
import { VisualizationService } from './services/visualization.service.js';
import { HealthScoreService } from './services/health-score.service.js';
import { PerformanceAlertService } from './services/performance-alert.service.js';
import { QualityScorerService } from './services/quality-scorer.service.js';
import { Review } from '../../database/entities/review.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';
import { Notification } from '../../database/entities/notification.entity.js';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';
import { TestRun } from '../../database/entities/test-run.entity.js';
import { MetricsController } from './metrics.controller.js';
import { ReviewModule } from '../review/review.module.js';
import { ConfigModule } from '../../config/config.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Review,
      ReviewMetrics,
      PullRequest,
      Comment,
      DeveloperMetrics,
      Notification,
      SecurityFinding,
      TestRun,
    ]),
    forwardRef(() => ReviewModule),
    ConfigModule,
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService, 
    CoverageTrackerService, 
    CoverageService, 
    SLAMonitorService, 
    VisualizationService,
    HealthScoreService,
    PerformanceAlertService,
    QualityScorerService
  ],
  exports: [
    MetricsService, 
    CoverageTrackerService, 
    CoverageService, 
    SLAMonitorService, 
    VisualizationService,
    HealthScoreService,
    PerformanceAlertService,
    QualityScorerService
  ],
})
export class MetricsModule {}
