import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull } from 'typeorm';
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
    if (!shouldNotify) return null;

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
      const userEmail = 'dev@example.com'; 
      const emailContent = this.emailService.formatNotificationEmail(saved);
      await this.emailService.sendEmail(userEmail, emailContent.subject, emailContent.text, emailContent.html);
      await this.notificationRepository.update(saved.id, { sentAt: new Date() });
    }

    return saved;
  }

  async processSmartNotification(recipientId: number, type: string, title: string, message: string, priority: string = 'normal', data: any = {}) {
    if (priority === 'low') {
      const batchId = `batch-${new Date().toISOString().split('T')[0]}`;
      const notification = this.notificationRepository.create({
        recipientId,
        notificationType: type,
        title,
        message,
        priority,
        data,
        isBatched: true,
        batchId,
        createdAt: new Date(),
      });
      return await this.notificationRepository.save(notification);
    }

    return await this.sendNotification(recipientId, type, title, message, priority, data);
  }

  async flushBatches() {
    const batched = await this.notificationRepository.find({
      where: { isBatched: true, sentAt: IsNull() }
    });

    const recipientIds = [...new Set(batched.map(n => n.recipientId))];

    for (const rid of recipientIds) {
      const userNotifications = batched.filter(n => n.recipientId === rid);
      this.logger.log(`Flushing ${userNotifications.length} batched notifications for user ${rid}`);
      
      if (this.emailService && userNotifications.length > 0) {
        const summary = `You have ${userNotifications.length} new notifications.`;
        const combinedMessage = userNotifications.map(n => `- ${n.title}: ${n.message}`).join('\n');
        
        await this.emailService.sendEmail('dev@example.com', `[PR Review Agent] Notification Digest`, combinedMessage);
        
        for (const n of userNotifications) {
          await this.notificationRepository.update(n.id, { sentAt: new Date() });
        }
      }
    }
  }

  async shouldNotify(recipientId: number, type: string): Promise<boolean> {
    return true; 
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
