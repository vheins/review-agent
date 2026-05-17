import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { MissionSession } from '../../../database/entities/mission-session.entity.js';
import { MissionStep } from '../../../database/entities/mission-step.entity.js';
import { NotificationService } from '../../../common/notification/notification.service.js';
import { SessionLedgerService } from './session-ledger.service.js';

/**
 * StuckTaskDetectorService - Service for detecting and recovering stuck mission sessions
 * 
 * Requirements: 13.2
 */
@Injectable()
export class StuckTaskDetectorService implements OnModuleInit {
  private readonly logger = new Logger(StuckTaskDetectorService.name);
  private readonly timeoutHours = 1;

  constructor(
    @InjectRepository(MissionSession)
    private readonly sessionRepository: Repository<MissionSession>,
    @InjectRepository(MissionStep)
    private readonly stepRepository: Repository<MissionStep>,
    private readonly notificationService: NotificationService,
    private readonly ledger: SessionLedgerService,
  ) {}

  onModuleInit() {
    // Check for stuck tasks every 30 minutes
    setInterval(() => this.detectStuckTasks(), 30 * 60 * 1000);
  }

  /**
   * Detect and attempt to recover stuck mission sessions
   */
  async detectStuckTasks(): Promise<MissionSession[]> {
    const timeoutMs = this.timeoutHours * 60 * 60 * 1000;
    const threshold = new Date(Date.now() - timeoutMs);

    const stuckSessions = await this.sessionRepository.find({
      where: {
        status: 'running',
        updatedAt: LessThan(threshold)
      }
    });

    if (stuckSessions.length > 0) {
      this.logger.warn(`Detected ${stuckSessions.length} stuck mission sessions.`);
      for (const session of stuckSessions) {
        await this.recoverTask(session);
      }
    }

    return stuckSessions;
  }

  private async recoverTask(session: MissionSession) {
    const maxRetries = 3;
    const activeStep = await this.stepRepository.findOne({
      where: { sessionId: session.id, status: 'running' } // in_progress changed to running
    });

    const attemptCount = activeStep?.attemptCount || 0;

    if (attemptCount < maxRetries) {
      this.logger.warn(`Recovering stuck task #${session.id}, attempt ${attemptCount + 1}`);
      
      await this.sessionRepository.update(session.id, {
        status: 'paused',
        updatedAt: new Date()
      });

      if (activeStep) {
        await this.stepRepository.update(activeStep.id, {
          status: 'failed',
          completedAt: new Date(),
          lastErrorSummary: 'Task timed out and was recovered'
        });
      }

      await this.ledger.append(session.id, 'recovery', 'system', `Stuck task recovered. Moved to paused. Attempt ${attemptCount + 1}`);
    } else {
      this.logger.error(`Task #${session.id} reached max retries. Marking as failed.`);
      
      await this.sessionRepository.update(session.id, {
        status: 'failed',
        failureReason: 'Max retries reached after stuck detections',
        updatedAt: new Date()
      });

      await this.ledger.append(session.id, 'mission_failed', 'system', 'Mission failed: Max retries reached after stuck detections');

      await this.notificationService.sendNotification(
        1,
        'task_failure',
        'Critical Task Failure',
        `Mission session #${session.id} failed after ${maxRetries} retries.`,
        'urgent'
      );
    }
  }
}
