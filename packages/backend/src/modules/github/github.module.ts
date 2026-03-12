import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GitHubClientService } from './github.service.js';
import { RepositoryManagerService } from './services/repository-manager.service.js';
import { Repository } from '../../database/entities/repository.entity.js';
import { ConfigModule } from '../../config/config.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Repository]),
    ConfigModule,
  ],
  providers: [GitHubClientService, RepositoryManagerService],
  exports: [GitHubClientService, RepositoryManagerService],
})
export class GitHubModule {}
