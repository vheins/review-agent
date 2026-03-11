import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewEngineService } from './review-engine.service.js';
import { ReviewQueueService } from './review-queue.service.js';
import { GitHubModule } from '../github/github.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { Review } from '../../database/entities/review.entity.js';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';

import { ReviewController } from './review.controller.js';

/**
 * ReviewModule - Module for core review orchestration
 * 
 * Requirements: 7.1
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Review, PullRequest, Comment, ReviewMetrics]),
    GitHubModule,
    AiModule,
    ConfigModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewEngineService, ReviewQueueService],
  exports: [ReviewEngineService, ReviewQueueService],
})
export class ReviewModule {}
