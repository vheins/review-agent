import { Injectable, OnModuleDestroy, BeforeApplicationShutdown, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../database/entities/review.entity.js';

@Injectable()
export class GracefulShutdownService implements OnModuleDestroy, BeforeApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private activeTasks = new Set<string>();
  private isShuttingDown = false;

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  trackTask(taskId: string) {
    this.activeTasks.add(taskId);
  }

  untrackTask(taskId: string) {
    this.activeTasks.delete(taskId);
  }

  async beforeApplicationShutdown(signal?: string) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.warn(`Received ${signal}. Starting graceful shutdown...`);

    const shutdownTimeout = 30000;
    const start = Date.now();

    while (this.activeTasks.size > 0 && (Date.now() - start) < shutdownTimeout) {
      this.logger.log(`Waiting for ${this.activeTasks.size} active tasks to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeTasks.size > 0) {
      this.logger.error(`Shutdown timeout reached. ${this.activeTasks.size} tasks still active.`);
      await this.markInterruptedTasks();
    }
  }

  private async markInterruptedTasks() {
    await this.reviewRepository.update({ status: 'processing' }, {
      status: 'failed',
      completedAt: new Date(),
    });
  }

  onModuleDestroy() {
    this.logger.log('GracefulShutdownService module destroyed');
  }
}
