import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PullRequestController } from './pull-request.controller.js';
import { DashboardController } from './dashboard.controller.js';
import { PullRequestService } from './pull-request.service.js';
import { BatchProcessorService } from './batch-processor.service.js';
import { PullRequest as PullRequestEntity } from '../../database/entities/pull-request.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { RepositoryConfig } from '../../database/entities/repository-config.entity.js';
import { GitHubModule } from '../github/github.module.js';
import { ReviewModule } from '../review/review.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PullRequestEntity, ReviewMetrics, RepositoryConfig]),
    GitHubModule,
    ReviewModule,
    AiModule,
  ],
  controllers: [PullRequestController, DashboardController],
  providers: [PullRequestService, BatchProcessorService],
  exports: [PullRequestService, BatchProcessorService],
})
export class PullRequestModule {}
