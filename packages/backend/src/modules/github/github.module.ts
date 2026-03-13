import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GitHubClientService } from './github.service.js';
import { RepositoryManagerService } from './services/repository-manager.service.js';
import { GithubApiService } from './services/github-api.service.js';
import { GithubCliService } from './services/github-cli.service.js';
import { Repository } from '../../database/entities/repository.entity.js';
import { ConfigModule } from '../../config/config.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Repository]),
    ConfigModule,
  ],
  providers: [
    GitHubClientService, 
    RepositoryManagerService,
    GithubApiService,
    GithubCliService
  ],
  exports: [
    GitHubClientService, 
    RepositoryManagerService,
    GithubApiService,
    GithubCliService
  ],
})
export class GitHubModule {}
