import { dbManager } from './database.js';
import { logger } from './logger.js';

export class NotificationService {
  constructor() {}

  async sendNotification(recipientId, type, title, message, priority = 'normal', data = {}) {
    if (!dbManager.isAvailable()) return null;

    const shouldNotify = await this.shouldNotify(recipientId, type);
    if (!shouldNotify) {
      logger.info(`Notification of type ${type} suppressed for user ${recipientId} due to preferences`);
      return null;
    }

    return dbManager.db.prepare(`
      INSERT INTO notifications (
        recipient_id, notification_type, title, message, priority, 
        data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(recipientId, type, title, message, priority, JSON.stringify(data)).lastInsertRowid;
  }

  async shouldNotify(recipientId, type) {
    if (!dbManager.isAvailable()) return false;

    const dev = dbManager.db.prepare('SELECT notification_preferences FROM developers WHERE id = ?').get(recipientId);
    if (!dev) return false;

    try {
      const prefs = JSON.parse(dev.notification_preferences || '{}');
      
      // 1. Check if type is enabled
      if (prefs.disabledTypes && prefs.disabledTypes.includes(type)) return false;
      
      // 2. Check quiet hours
      if (prefs.quietHours && this.isQuietHours(prefs.quietHours)) return false;

      // 3. Global enable
      if (prefs.enabled === false) return false;

      return true;
    } catch (e) {
      return true; // Default to notify on parse error
    }
  }

  isQuietHours(quietHours) {
    // quietHours: { start: "22:00", end: "08:00" }
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    if (quietHours.start < quietHours.end) {
      return currentTime >= quietHours.start && currentTime <= quietHours.end;
    } else {
      // Overnight (e.g. 22:00 to 08:00)
      return currentTime >= quietHours.start || currentTime <= quietHours.end;
    }
  }

  async markAsRead(notificationId) {
    if (!dbManager.isAvailable()) return;
    dbManager.db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notificationId);
  }

  async getUnreadNotifications(recipientId) {
    if (!dbManager.isAvailable()) return [];
    return dbManager.db.prepare('SELECT * FROM notifications WHERE recipient_id = ? AND is_read = 0 ORDER BY created_at DESC').all(recipientId);
  }

  async sendBatch(recipientId, batchId = null) {
    if (!dbManager.isAvailable()) return;

    const unread = await this.getUnreadNotifications(recipientId);
    if (unread.length === 0) return;

    // Filter by batchId if provided, otherwise batch all unread
    const toBatch = batchId ? unread.filter(n => n.batch_id === batchId) : unread;
    if (toBatch.length === 0) return;

    const summary = `You have ${toBatch.length} new notifications.`;
    const combinedMessage = toBatch.map(n => `- ${n.title}: ${n.message}`).join('\n');

    // In a real app, we'd send this via EmailDeliveryService
    // For now, we mark them as sent in batch
    const notificationIds = toBatch.map(n => n.id);
    dbManager.transaction(() => {
      const updateStmt = dbManager.db.prepare('UPDATE notifications SET sent_at = CURRENT_TIMESTAMP WHERE id = ?');
      for (const id of notificationIds) {
        updateStmt.run(id);
      }
    })();

    return { summary, combinedMessage, count: toBatch.length };
  }

  async generateDailyDigest(recipientId) {
    if (!dbManager.isAvailable()) return null;

    // Fetch notifications from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const notifications = dbManager.db.prepare(`
      SELECT * FROM notifications 
      WHERE recipient_id = ? AND created_at >= ?
    `).all(recipientId, yesterday);

    if (notifications.length === 0) return null;

    const digest = {
      recipientId,
      date: new Date().toLocaleDateString(),
      totalNotifications: notifications.length,
      byType: {},
      notifications: notifications.map(n => ({ title: n.title, type: n.notification_type }))
    };

    for (const n of notifications) {
      digest.byType[n.notification_type] = (digest.byType[n.notification_type] || 0) + 1;
    }

    return digest;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
