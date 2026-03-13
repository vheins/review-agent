import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataExporterService } from './data-exporter.service.js';
import { ConfigModule } from '../../config/config.module.js';
import { Export } from '../../database/entities/export.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { Review } from '../../database/entities/review.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Export, ReviewMetrics, Review]),
    ConfigModule,
  ],
  providers: [DataExporterService],
  exports: [DataExporterService],
})
export class DataExporterModule {}
