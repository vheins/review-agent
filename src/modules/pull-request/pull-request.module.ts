import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PullRequestController } from './pull-request.controller.js';
import { PullRequestService } from './pull-request.service.js';
import { PullRequest as PullRequestEntity } from '../../database/entities/pull-request.entity.js';
import { GitHubModule } from '../github/github.module.js';
import { ReviewModule } from '../review/review.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PullRequestEntity]),
    GitHubModule,
    ReviewModule,
  ],
  controllers: [PullRequestController],
  providers: [PullRequestService],
  exports: [PullRequestService],
})
export class PullRequestModule {}
