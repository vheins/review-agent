import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { PullRequest } from '../../../database/entities/pull-request.entity.js';
import { NotificationService } from '../../../common/notification/notification.service.js';

@Injectable()
export class SlaMonitorService {
  private readonly logger = new Logger(SlaMonitorService.name);

  constructor(
    @InjectRepository(PullRequest)
    private readonly prRepository: Repository<PullRequest>,
    @Optional()
    private readonly notificationService: NotificationService,
  ) {}

  async checkAllSLAs(): Promise<void> {
    const openPRs = await this.prRepository.find({
      where: { status: 'open' }
    });

    for (const pr of openPRs) {
      await this.checkPR_SLA(pr);
    }
  }

  async checkPR_SLA(pr: PullRequest): Promise<void> {
    const now = new Date();
    const createdAt = new Date(pr.createdAt);
    // In our NestJS implementation, we might not have sla_hours yet in PR entity.
    // Use default 24h for now.
    const slaHours = 24;
    const slaMs = slaHours * 60 * 60 * 1000;
    const elapsedMs = now.getTime() - createdAt.getTime();
    
    const progressPercent = (elapsedMs / slaMs) * 100;

    if (progressPercent >= 100) {
      this.logger.warn(`PR #${pr.number} in ${pr.repository} breached SLA`);
      // Trigger escalation...
    } else if (progressPercent >= 90) {
      await this.sendSLAWarning(pr, '90%', 'urgent');
    } else if (progressPercent >= 75) {
      await this.sendSLAWarning(pr, '75%', 'high');
    }
  }

  private async sendSLAWarning(pr: PullRequest, threshold: string, priority: string): Promise<void> {
    this.logger.log(`Sending SLA warning for PR #${pr.number} (${threshold})`);
    
    if (this.notificationService) {
      // Send to PR author as a placeholder
      // In a real app, find assigned reviewers
      await this.notificationService.sendNotification(
        1, // Simulation
        'sla_warning',
        `SLA Warning: PR #${pr.number} (${threshold})`,
        `PR #${pr.number} "${pr.title}" is approaching its SLA limit. Current progress: ${threshold}.`,
        priority as any,
        { prNumber: pr.number, repository: pr.repository, threshold }
      );
    }
  }

  async getSLAComplianceRate(repository: string, daysLookback: number = 30): Promise<number> {
    const since = new Date(Date.now() - daysLookback * 24 * 60 * 60 * 1000);
    
    const mergedPRs = await this.prRepository.find({
      where: {
        repository,
        status: 'merged',
        updatedAt: MoreThanOrEqual(since)
      }
    });

    if (mergedPRs.length === 0) return 100;

    const slaHours = 24;
    const compliant = mergedPRs.filter(pr => {
      const durationHours = (pr.updatedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60);
      return durationHours <= slaHours;
    }).length;

    return (compliant / mergedPRs.length) * 100;
  }
}
