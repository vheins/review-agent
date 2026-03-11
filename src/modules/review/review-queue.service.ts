import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ReviewEngineService } from './review-engine.service.js';
import { PullRequest } from '../github/github.service.js';

export enum QueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface QueueItem {
  pr: PullRequest;
  status: QueueStatus;
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
}

/**
 * ReviewQueueService - Service for managing asynchronous PR review queue
 * 
 * Features:
 * - In-memory queue with concurrency control
 * - Support for "continuous" processing mode
 * - Task timeout and stuck task detection
 * - Persistence (via ReviewEngineService's DB interactions)
 * 
 * Requirements: 11.1, 11.2, 11.3
 */
@Injectable()
export class ReviewQueueService implements OnModuleInit {
  private readonly logger = new Logger(ReviewQueueService.name);
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private readonly maxConcurrency = 2; // Default limit
  private readonly maxRetries = 3;
  private isRunning = false;

  constructor(private readonly reviewEngine: ReviewEngineService) {}

  onModuleInit() {
    // We don't start automatically, wait for explicit start call if needed
  }

  /**
   * Add a Pull Request to the queue
   */
  async addToQueue(pr: PullRequest): Promise<void> {
    const existing = this.queue.find(item => item.pr.number === pr.number && item.pr.repository.nameWithOwner === pr.repository.nameWithOwner);
    
    if (existing && (existing.status === QueueStatus.PENDING || existing.status === QueueStatus.PROCESSING)) {
      this.logger.log(`PR #${pr.number} is already in queue with status ${existing.status}`);
      return;
    }

    this.queue.push({
      pr,
      status: QueueStatus.PENDING,
      addedAt: new Date(),
      retryCount: 0,
    });

    this.logger.log(`Added PR #${pr.number} to queue. Queue size: ${this.queue.length}`);
    
    // Trigger processing
    this.processNext();
  }

  /**
   * Start the continuous processing loop
   */
  startContinuous(intervalMs = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.log(`Starting Review Queue in continuous mode (interval: ${intervalMs}ms)`);
    
    const loop = async () => {
      if (!this.isRunning) return;
      
      // Here we could also fetch new PRs from GitHub and add them to queue
      // But for now we rely on external triggers or manual scan
      
      this.processNext();
      setTimeout(loop, intervalMs);
    };
    
    loop();
  }

  /**
   * Stop the processing loop
   */
  stop(): void {
    this.isRunning = false;
    this.logger.log('Stopping Review Queue processing');
  }

  /**
   * Process next items in queue based on concurrency limit
   */
  private async processNext(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency) return;

    const nextItem = this.queue.find(item => item.status === QueueStatus.PENDING);
    if (!nextItem) return;

    this.activeCount++;
    nextItem.status = QueueStatus.PROCESSING;
    nextItem.startedAt = new Date();

    this.logger.log(`Processing PR #${nextItem.pr.number} (${this.activeCount}/${this.maxConcurrency} active)`);

    try {
      // Execute review with a timeout
      const success = await Promise.race([
        this.reviewEngine.reviewPullRequest(nextItem.pr),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Review timeout')), 300000) // 5 min timeout
        )
      ]);

      if (success) {
        nextItem.status = QueueStatus.COMPLETED;
        nextItem.completedAt = new Date();
        this.logger.log(`Completed PR #${nextItem.pr.number} successfully`);
      } else {
        throw new Error('Review failed without specific error');
      }
    } catch (error) {
      this.logger.error(`Error processing PR #${nextItem.pr.number}: ${error.message}`);
      nextItem.error = error.message;
      
      if (nextItem.retryCount < this.maxRetries) {
        nextItem.retryCount++;
        nextItem.status = QueueStatus.PENDING;
        this.logger.log(`Retrying PR #${nextItem.pr.number} (${nextItem.retryCount}/${this.maxRetries})`);
      } else {
        nextItem.status = QueueStatus.FAILED;
        nextItem.completedAt = new Date();
      }
    } finally {
      this.activeCount--;
      // Process next item immediately if there's more in queue
      this.processNext();
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      size: this.queue.length,
      active: this.activeCount,
      pending: this.queue.filter(i => i.status === QueueStatus.PENDING).length,
      processing: this.queue.filter(i => i.status === QueueStatus.PROCESSING).length,
      completed: this.queue.filter(i => i.status === QueueStatus.COMPLETED).length,
      failed: this.queue.filter(i => i.status === QueueStatus.FAILED).length,
    };
  }

  /**
   * Get all queue items
   */
  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  /**
   * Clear completed and failed items
   */
  clearFinished(): void {
    this.queue = this.queue.filter(i => i.status === QueueStatus.PENDING || i.status === QueueStatus.PROCESSING);
  }
}
