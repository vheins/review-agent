import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewEngineService } from './review-engine.service.js';
import { ReviewQueueService } from './review-queue.service.js';
import { ChecklistService } from './checklist.service.js';
import { AutoFixService } from './services/auto-fix.service.js';
import { DiscussionService } from './services/discussion.service.js';
import { GitHubModule } from '../github/github.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { SecurityModule } from '../security/security.module.js';
import { TeamModule } from '../team/team.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { OrchestrationModule } from '../orchestration/orchestration.module.js';
import { Review, PullRequest, Comment, ReviewMetrics, Checklist, ChecklistItem, ReviewChecklist } from '../../database/entities/index.js';

import { ReviewController } from './review.controller.js';

/**
 * ReviewModule - Module for core review orchestration
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Review, PullRequest, Comment, ReviewMetrics, Checklist, ChecklistItem, ReviewChecklist]),
    GitHubModule,
    AiModule,
    ConfigModule,
    SecurityModule,
    TeamModule,
    MetricsModule,
    OrchestrationModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewEngineService, ReviewQueueService, ChecklistService, AutoFixService, DiscussionService],
  exports: [ReviewEngineService, ReviewQueueService, ChecklistService, AutoFixService, DiscussionService],
})
export class ReviewModule {}
