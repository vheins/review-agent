import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Notification } from '../../database/entities/notification.entity.js';
import { EmailService } from './email.service.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @Optional()
    private readonly emailService: EmailService,
  ) {}

  async sendNotification(
    recipientId: number,
    type: string,
    title: string,
    message: string,
    priority: string = 'normal',
    data: any = {}
  ): Promise<Notification | null> {
    const shouldNotify = await this.shouldNotify(recipientId, type);
    if (!shouldNotify) {
      this.logger.log(`Notification of type ${type} suppressed for user ${recipientId}`);
      return null;
    }

    const notification = this.notificationRepository.create({
      recipientId,
      notificationType: type,
      title,
      message,
      priority,
      data,
      createdAt: new Date(),
    });

    const saved = await this.notificationRepository.save(notification);

    if (priority === 'urgent' && this.emailService) {
      // In a real app, fetch user email from developer repository
      const userEmail = 'dev@example.com'; 
      const emailContent = this.emailService.formatNotificationEmail(saved);
      await this.emailService.sendEmail(userEmail, emailContent.subject, emailContent.text, emailContent.html);
      
      await this.notificationRepository.update(saved.id, { sentAt: new Date() });
    }

    return saved;
  }

  async shouldNotify(recipientId: number, type: string): Promise<boolean> {
    return true; // Simplified
  }

  async markAsRead(notificationId: number): Promise<void> {
    await this.notificationRepository.update(notificationId, { isRead: true });
  }

  async getUnreadNotifications(recipientId: number): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { recipientId, isRead: false },
      order: { createdAt: 'DESC' }
    });
  }

  async generateDailyDigest(recipientId: number) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const notifications = await this.notificationRepository.find({
      where: {
        recipientId,
        createdAt: MoreThanOrEqual(since)
      }
    });

    if (notifications.length === 0) return null;

    const digest: any = {
      recipientId,
      date: new Date().toLocaleDateString(),
      totalNotifications: notifications.length,
      byType: {},
      notifications: notifications.map(n => ({ title: n.title, type: n.notificationType }))
    };

    for (const n of notifications) {
      digest.byType[n.notificationType] = (digest.byType[n.notificationType] || 0) + 1;
    }

    return digest;
  }
}
