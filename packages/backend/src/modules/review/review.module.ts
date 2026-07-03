import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewEngineService } from './review-engine.service.js';
import { ReviewQueueService } from './review-queue.service.js';
import { ChecklistService } from './checklist.service.js';
import { AutoFixService } from './services/auto-fix.service.js';
import { DiscussionService } from './services/discussion.service.js';
import { FalsePositiveService } from './services/false-positive.service.js';
import { RejectionCategorizerService } from './services/rejection-categorizer.service.js';
import { DocumentationReviewService } from './services/documentation-review.service.js';
import { RuleEngineService } from './services/rule-engine.service.js';
import { TaskLockService } from './services/task-lock.service.js';
import { TemplateService } from './services/template.service.js';
import { TestAndHealService } from './services/test-and-heal.service.js';
import { GitHubModule } from '../github/github.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { SecurityModule } from '../security/security.module.js';
import { TeamModule } from '../team/team.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { OrchestrationModule } from '../orchestration/orchestration.module.js';
import { Review, PullRequest, Comment, ReviewMetrics, Checklist, ChecklistItem, ReviewChecklist } from '../../database/entities/index.js';
import { CustomRule } from '../../database/entities/custom-rule.entity.js';
import { ReviewTemplate } from '../../database/entities/review-template.entity.js';
import { TestRun } from '../../database/entities/test-run.entity.js';

import { ReviewController } from './review.controller.js';

/**
 * ReviewModule - Module for core review orchestration
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Review, 
      PullRequest, 
      Comment, 
      ReviewMetrics, 
      Checklist, 
      ChecklistItem, 
      ReviewChecklist,
      CustomRule,
      ReviewTemplate,
      TestRun,
    ]),
    GitHubModule,
    AiModule,
    ConfigModule,
    SecurityModule,
    TeamModule,
    MetricsModule,
    OrchestrationModule,
  ],
  controllers: [ReviewController],
  providers: [
    ReviewEngineService, 
    ReviewQueueService, 
    ChecklistService, 
    AutoFixService, 
    DiscussionService, 
    FalsePositiveService,
    RejectionCategorizerService,
    DocumentationReviewService,
    RuleEngineService,
    TaskLockService,
    TemplateService,
    TestAndHealService,
  ],
  exports: [
    ReviewEngineService, 
    ReviewQueueService, 
    ChecklistService, 
    AutoFixService, 
    DiscussionService, 
    FalsePositiveService,
    RejectionCategorizerService,
    DocumentationReviewService,
    RuleEngineService,
    TaskLockService,
    TemplateService,
    TestAndHealService,
  ],
})
export class ReviewModule {}
