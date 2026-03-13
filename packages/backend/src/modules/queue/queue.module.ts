import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Job } from '../../database/entities/job.entity.js';
import { QueueService } from './queue.service.js';
import { QueueController } from './queue.controller.js';
import { ReviewModule } from '../review/review.module.js';
import { SecurityModule } from '../security/security.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
    ScheduleModule.forRoot(),
    ReviewModule,
    SecurityModule,
  ],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
