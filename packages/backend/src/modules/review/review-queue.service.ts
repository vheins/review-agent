import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ReviewEngineService } from './review-engine.service.js';
import { PullRequest } from '../github/github.service.js';
import { MissionControlService } from '../orchestration/services/mission-control.service.js';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../../common/notification/notification.service.js';

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
  missionId?: string;
}

/**
 * ReviewQueueService - Service for managing asynchronous PR review queue
 */
@Injectable()
export class ReviewQueueService implements OnModuleInit {
  private readonly logger = new Logger(ReviewQueueService.name);
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private readonly maxConcurrency = 2;
  private readonly maxRetries = 3;
  private isRunning = false;
  private missionControlEnabled = false;

  constructor(
    private readonly reviewEngine: ReviewEngineService,
    private readonly missionControl: MissionControlService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    this.missionControlEnabled = this.configService.get<boolean>('MISSION_CONTROL_ENABLED', false);
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
      this.detectStuckTasks();
      this.processNext();
      setTimeout(loop, intervalMs);
    };
    loop();
  }

  /**
   * Detect tasks that have been processing for too long and reset them
   */
  private async detectStuckTasks(): Promise<void> {
    const now = new Date();
    const timeoutMs = 300000; // 5 minutes

    for (const item of this.queue) {
      if (item.status === QueueStatus.PROCESSING && item.startedAt) {
        const duration = now.getTime() - item.startedAt.getTime();
        if (duration > timeoutMs) {
          this.logger.warn(`Detected stuck task for PR #${item.pr.number}.`);
          await this.recoverTask(item);
        }
      }
    }
  }

  private async recoverTask(item: QueueItem): Promise<void> {
    if (item.retryCount < this.maxRetries) {
      this.logger.warn(`Recovering stuck task for PR #${item.pr.number}, attempt ${item.retryCount + 1}`);
      item.status = QueueStatus.PENDING;
      item.error = 'Task timed out (stuck detector)';
      item.retryCount++;
      this.activeCount = Math.max(0, this.activeCount - 1);
      
      if (this.missionControlEnabled && item.missionId) {
        await this.missionControl.pauseMission(item.missionId, 'Task timed out').catch(e => 
          this.logger.error(`Failed to pause mission ${item.missionId}: ${e.message}`)
        );
      }
    } else {
      this.logger.error(`PR #${item.pr.number} reached max retries. Marking as failed.`);
      item.status = QueueStatus.FAILED;
      item.completedAt = new Date();
      this.activeCount = Math.max(0, this.activeCount - 1);

      if (this.notificationService) {
        // In a real app, find admin users. Here we'll simulate sending to recipient 1.
        await this.notificationService.sendNotification(
          1,
          'task_failure',
          'Critical Task Failure',
          `Review for PR #${item.pr.number} failed after ${this.maxRetries} retries.`,
          'urgent'
        );
      }
    }
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
      if (this.missionControlEnabled) {
        if (!nextItem.missionId) {
          const session = await this.missionControl.startMission(nextItem.pr, 'review-only', 'review-only');
          nextItem.missionId = session.id;
        } else {
          await this.missionControl.resumeMission(nextItem.missionId);
        }
      }

      const success = await Promise.race([
        this.reviewEngine.reviewPullRequest(nextItem.pr),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Review timeout')), 300000)
        )
      ]);

      if (success) {
        nextItem.status = QueueStatus.COMPLETED;
        nextItem.completedAt = new Date();
        this.logger.log(`Completed PR #${nextItem.pr.number} successfully`);
        
        if (this.missionControlEnabled && nextItem.missionId) {
          const session = await (this.missionControl as any).sessionRepository.findOne({ 
            where: { id: nextItem.missionId },
            relations: ['steps']
          });
          
          for (const step of session?.steps || []) {
            if (step.status === 'pending') {
              await this.missionControl.completeStep(step.id, 'completed');
            }
          }
        }
      } else {
        throw new Error('Review failed without specific error');
      }
    } catch (error) {
      this.logger.error(`Error processing PR #${nextItem.pr.number}: ${error.message}`);
      nextItem.error = error.message;
      await this.recoverTask(nextItem);
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }

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

  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  clearFinished(): void {
    this.queue = this.queue.filter(i => i.status === QueueStatus.PENDING || i.status === QueueStatus.PROCESSING);
  }
}
