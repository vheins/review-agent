import { Module } from '@nestjs/common';
import { DataExporterService } from './data-exporter.service.js';

@Module({
  providers: [DataExporterService],
  exports: [DataExporterService],
})
export class DataExporterModule {}
