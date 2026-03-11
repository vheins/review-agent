import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceReporterService } from './compliance-reporter.service.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { Review } from '../../database/entities/review.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, Review]),
  ],
  providers: [ComplianceReporterService],
  exports: [ComplianceReporterService],
})
export class ComplianceModule {}
