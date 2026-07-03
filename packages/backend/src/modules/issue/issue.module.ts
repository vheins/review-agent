import { Module } from '@nestjs/common';
import { IssueResolverService } from './issue-resolver.service.js';
import { GitHubModule } from '../github/github.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [GitHubModule, AiModule],
  providers: [IssueResolverService],
  exports: [IssueResolverService],
})
export class IssueModule {}
