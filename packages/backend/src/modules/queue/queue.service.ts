import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { Job, JobStatus } from '../../database/entities/job.entity.js';
import { ReviewEngineService } from '../review/review-engine.service.js';
import { AutoFixService } from '../review/services/auto-fix.service.js';
import { SecurityScannerService } from '../security/security-scanner.service.js';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly reviewEngine: ReviewEngineService,
    private readonly autoFixService: AutoFixService,
    private readonly securityScanner: SecurityScannerService,
  ) {}

  onModuleInit() {
    this.logger.log('Queue worker initialized');
  }

  /**
   * Push a new job to the queue
   */
  async push(type: string, payload: any, maxAttempts: number = 3): Promise<Job> {
    const job = this.jobRepository.create({
      type,
      payload,
      maxAttempts,
      status: JobStatus.PENDING,
    });
    return this.jobRepository.save(job);
  }

  /**
   * Background worker: process pending jobs every 10 seconds
   */
  @Interval(10000)
  async handleTick() {
    if (this.isProcessing) return;
    await this.processJobs();
  }

  async processJobs() {
    this.isProcessing = true;
    try {
      const pendingJobs = await this.jobRepository.find({
        where: { status: JobStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: 5,
      });

      for (const job of pendingJobs) {
        await this.runJob(job);
      }
    } catch (error) {
      this.logger.error(`Error in queue worker tick: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async runJob(job: Job) {
    this.logger.log(`Processing job ${job.id} (${job.type})`);
    
    await this.jobRepository.update(job.id, {
      status: JobStatus.PROCESSING,
      startedAt: new Date(),
      attempts: job.attempts + 1,
    });

    try {
      // Dispatch based on job type
      switch (job.type) {
        case 'pr_review':
          await this.reviewEngine.reviewPullRequest(job.payload);
          break;
        case 'auto_fix':
          // Assume payload contains required data for auto-fix
          // await this.autoFixService.applyFixes(job.payload);
          break;
        case 'security_scan':
          // await this.securityScanner.scan(job.payload);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      await this.jobRepository.update(job.id, {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
      });
      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      
      const shouldRetry = job.attempts + 1 < job.maxAttempts;
      await this.jobRepository.update(job.id, {
        status: shouldRetry ? JobStatus.PENDING : JobStatus.FAILED,
        error: error.message,
        completedAt: !shouldRetry ? new Date() : null,
      });
    }
  }

  /**
   * Get all jobs for monitoring
   */
  async getJobs(limit = 50) {
    return this.jobRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Retry a failed job
   */
  async retryJob(id: string) {
    await this.jobRepository.update(id, {
      status: JobStatus.PENDING,
      attempts: 0,
      error: null,
    });
    return { status: 'retry_queued' };
  }
}
