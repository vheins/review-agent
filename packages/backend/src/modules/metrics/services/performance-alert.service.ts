import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../../database/entities/notification.entity.js';
import { MetricsService } from '../metrics.service.js';

/**
 * PerformanceAlertService - Service for monitoring developer performance and triggering alerts
 * 
 * Requirements: 13.4
 */
@Injectable()
export class PerformanceAlertService {
  private readonly logger = new Logger(PerformanceAlertService.name);

  constructor(
    private readonly metrics: MetricsService,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Check developer performance against team average
   */
  async checkDeveloperPerformance(developerId: string, weeksToLookBack = 4): Promise<any> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (weeksToLookBack * 7));
    
    const filters = {
      startDate: startDate.toISOString(),
      endDate: today.toISOString()
    };

    const teamMetrics = await this.metrics.calculateMetrics(filters);
    const devMetrics = await this.metrics.getDeveloperMetrics(developerId, filters);
    
    if (!teamMetrics || !devMetrics || teamMetrics.total_reviews === 0) return null;

    const teamAvgApproval = teamMetrics.approval_rate;
    const devApproval = devMetrics.approval_rate;
    
    const teamAvgTime = teamMetrics.avg_duration;
    const devAvgTime = devMetrics.avg_review_time;

    let alertTriggered = false;
    let reasons = [];

    // Trigger alert if developer approval rate is >20% lower than team average
    if (devApproval < teamAvgApproval - 20) {
      alertTriggered = true;
      reasons.push(`Approval rate (${devApproval.toFixed(1)}%) is significantly below team average (${teamAvgApproval.toFixed(1)}%)`);
    }

    // Trigger alert if developer avg time is >50% slower than team average
    if (devAvgTime > teamAvgTime * 1.5) {
      alertTriggered = true;
      reasons.push(`Average review time is significantly higher than team average`);
    }

    if (alertTriggered) {
      await this.generateAlert(developerId, reasons);
    }

    return {
      alertTriggered,
      reasons,
      teamMetrics,
      devMetrics
    };
  }

  private async generateAlert(developerId: string, reasons: string[]) {
    const message = `Performance alert: ${reasons.join('. ')}`;
    
    // Convert developerId string to number if needed, for now assume it's used as recipientId
    // In our entity recipientId is integer, but here developerId is string (username)
    // We might need to look up the ID, but for now we'll mock it or use 1
    const notification = this.notificationRepository.create({
      recipientId: 1, // Default to admin or system for now
      notificationType: 'performance_alert',
      title: 'Performance Review Needed',
      message,
      priority: 'high',
      createdAt: new Date()
    });

    await this.notificationRepository.save(notification);
    this.logger.warn(`Performance alert generated for developer ${developerId}`);
  }
}
