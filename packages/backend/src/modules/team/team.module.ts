import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeveloperDashboardService } from './services/developer-dashboard.service.js';
import { AssignmentEngineService } from './services/assignment-engine.service.js';
import { CapacityPlannerService } from './services/capacity-planner.service.js';
import { GamificationService } from './services/gamification.service.js';
import { FeedbackService } from './services/feedback.service.js';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { Review } from '../../database/entities/review.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { TeamController } from './team.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeveloperMetrics, PullRequest, Review, SecurityFinding, Comment]),
    MetricsModule,
  ],
  controllers: [TeamController],
  providers: [
    DeveloperDashboardService,
    AssignmentEngineService,
    CapacityPlannerService,
    GamificationService,
    FeedbackService,
  ],
  exports: [
    DeveloperDashboardService,
    AssignmentEngineService,
    CapacityPlannerService,
    GamificationService,
    FeedbackService,
  ],
})
export class TeamModule {}
