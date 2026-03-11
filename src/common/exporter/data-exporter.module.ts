import { Module } from '@nestjs/common';
import { DataExporterService } from './data-exporter.service.js';
import { ConfigModule } from '../../config/config.module.js';

@Module({
  imports: [ConfigModule],
  providers: [DataExporterService],
  exports: [DataExporterService],
})
export class DataExporterModule {}
