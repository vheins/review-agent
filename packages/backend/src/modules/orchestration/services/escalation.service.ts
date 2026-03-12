import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service.js';
import { NotificationService } from '../../../common/notification/notification.service.js';
import { PullRequest } from '../../../database/entities/pull-request.entity.js';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @Optional()
    private readonly audit: AuditService,
    @Optional()
    private readonly notificationService: NotificationService,
    @InjectRepository(PullRequest)
    private readonly prRepository: Repository<PullRequest>,
  ) {}

  async escalate(resourceId: string, resourceType: string, reason: string, severity: string = 'high'): Promise<void> {
    const level = this.determineEscalationLevel(severity);
    if (level === 'none') return;

    // 1. Audit Trail
    await this.audit?.logAction(
      'escalation',
      'escalation-service',
      resourceType,
      resourceId,
      { reason, severity, level }
    );

    // 2. Notify (In a real app, find stakeholders by role)
    if (this.notificationService) {
      await this.notificationService.sendNotification(
        1, // Simulation: admin/lead ID
        'escalation',
        `ESCALATION: ${reason}`,
        `A ${resourceType} (#${resourceId}) has been escalated to you (Level: ${level}). Reason: ${reason}`,
        'urgent',
        { resourceId, resourceType, level }
      );
    }

    this.logger.warn(`Escalated ${resourceType} #${resourceId} to Level ${level}. Reason: ${reason}`);
  }

  private determineEscalationLevel(severity: string): string {
    if (severity === 'critical') return 'manager';
    if (severity === 'high') return 'lead';
    return 'none';
  }

  async checkSLABreaches(): Promise<void> {
    const now = new Date();
    const slaHours = 24; // Default
    
    const openPRs = await this.prRepository.find({
      where: { status: 'open' }
    });

    for (const pr of openPRs) {
      const elapsedHours = (now.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60);
      if (elapsedHours > slaHours) {
        await this.escalate(pr.number.toString(), 'pull_request', `SLA of ${slaHours}h exceeded`, 'high');
      }
    }
  }
}
