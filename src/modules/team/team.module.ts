import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeveloperDashboardService } from './services/developer-dashboard.service.js';
import { AssignmentEngineService } from './services/assignment-engine.service.js';
import { CapacityPlannerService } from './services/capacity-planner.service.js';
import { GamificationService } from './services/gamification.service.js';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { Review } from '../../database/entities/review.entity.js';
import { MetricsModule } from '../metrics/metrics.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeveloperMetrics, PullRequest, Review]),
    MetricsModule,
  ],
  providers: [
    DeveloperDashboardService,
    AssignmentEngineService,
    CapacityPlannerService,
    GamificationService,
  ],
  exports: [
    DeveloperDashboardService,
    AssignmentEngineService,
    CapacityPlannerService,
    GamificationService,
  ],
})
export class TeamModule {}
