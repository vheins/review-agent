import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PullRequestController } from './pull-request.controller.js';
import { DashboardController } from './dashboard.controller.js';
import { PullRequestService } from './pull-request.service.js';
import { BatchProcessorService } from './batch-processor.service.js';
import { AutoMergeService } from './services/auto-merge.service.js';
import { PullRequest as PullRequestEntity } from '../../database/entities/pull-request.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { RepositoryConfig } from '../../database/entities/repository-config.entity.js';
import { Review } from '../../database/entities/review.entity.js';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';
import { GitHubModule } from '../github/github.module.js';
import { ReviewModule } from '../review/review.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ConfigModule } from '../../config/config.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PullRequestEntity, 
      ReviewMetrics, 
      RepositoryConfig, 
      Review, 
      SecurityFinding
    ]),
    GitHubModule,
    ReviewModule,
    AiModule,
    ConfigModule,
  ],
  controllers: [PullRequestController, DashboardController],
  providers: [PullRequestService, BatchProcessorService, AutoMergeService],
  exports: [PullRequestService, BatchProcessorService, AutoMergeService],
})
export class PullRequestModule {}
