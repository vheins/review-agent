import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { GitHubModule } from '../../modules/github/github.module.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [GitHubModule, DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
