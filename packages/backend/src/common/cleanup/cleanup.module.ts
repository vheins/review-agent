import { Module } from '@nestjs/common';
import { ResourceCleanupService } from './resource-cleanup.service.js';
import { DataExporterModule } from '../exporter/data-exporter.module.js';
import { ConfigModule } from '../../config/config.module.js';

@Module({
  imports: [DataExporterModule, ConfigModule],
  providers: [ResourceCleanupService],
  exports: [ResourceCleanupService],
})
export class CleanupModule {}
