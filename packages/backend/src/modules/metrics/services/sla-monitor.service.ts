import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { PullRequest } from '../../../database/entities/pull-request.entity.js';
import { Notification } from '../../../database/entities/notification.entity.js';
import { AppConfigService } from '../../../config/app-config.service.js';

/**
 * SLAMonitorService - Service for monitoring PR SLAs
 * 
 * Requirements: 18.1
 */
@Injectable()
export class SLAMonitorService {
  private readonly logger = new Logger(SLAMonitorService.name);

  constructor(
    private readonly config: AppConfigService,
    @InjectRepository(PullRequest)
    private readonly prRepository: Repository<PullRequest>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Check for PRs that have breached SLA
   */
  async checkSLABreaches(): Promise<PullRequest[]> {
    const now = new Date();
    const reviewConfig = this.config.getReviewConfig();
    const slaHours = (reviewConfig as any).slaHours || 24;
    const deadline = new Date(now.getTime() - (slaHours * 60 * 60 * 1000));

    // Find open PRs that haven't been updated since deadline
    const breaches = await this.prRepository.find({
      where: {
        status: 'open',
        updatedAt: LessThan(deadline)
      }
    });

    for (const pr of breaches) {
      this.logger.warn(`SLA Breach detected for PR #${pr.number} in ${pr.repository}`);
      await this.notifyBreach(pr);
    }

    return breaches;
  }

  private async notifyBreach(pr: PullRequest) {
    const notification = this.notificationRepository.create({
      recipientId: 1, // Default system/admin ID
      notificationType: 'sla_breach',
      title: `SLA Breach: PR #${pr.number}`,
      message: `PR #${pr.number} in ${pr.repository} has exceeded SLA response time`,
      priority: 'high',
      createdAt: new Date()
    });

    await this.notificationRepository.save(notification);
  }
}
