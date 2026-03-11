import { Module } from '@nestjs/common';
import { GitHubClientService } from './github.service.js';
import { ConfigModule } from '../../config/config.module.js';

/**
 * GitHubModule - Module for GitHub CLI operations
 * 
 * Provides GitHubClientService for interacting with GitHub via `gh` CLI.
 * 
 * Requirements: 10.1
 */
@Module({
  imports: [ConfigModule],
  providers: [GitHubClientService],
  exports: [GitHubClientService],
})
export class GitHubModule {}
