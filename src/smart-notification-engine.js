import { dbManager } from './database.js';
import { notificationService } from './notification-service.js';
import { logger } from './logger.js';

export class SmartNotificationEngine {
  constructor() {}

  async processNotification(recipientId, type, title, message, priority = 'normal', data = {}) {
    // Smart logic:
    // 1. Check if user is currently active (if we had session data)
    // 2. Check for duplicate notifications in a short time window
    // 3. Batch low priority notifications
    
    if (priority === 'low') {
      return this.addToBatch(recipientId, type, title, message, data);
    }

    // High/Urgent priority are sent immediately
    return notificationService.sendNotification(recipientId, type, title, message, priority, data);
  }

  async addToBatch(recipientId, type, title, message, data) {
    if (!dbManager.isAvailable()) return null;

    // Use current day as batch_id for simple daily batching
    const batchId = `batch-${new Date().toISOString().split('T')[0]}`;

    return dbManager.db.prepare(`
      INSERT INTO notifications (
        recipient_id, notification_type, title, message, priority, 
        data, is_batched, batch_id, created_at
      ) VALUES (?, ?, ?, ?, 'low', ?, 1, ?, CURRENT_TIMESTAMP)
    `).run(recipientId, type, title, message, JSON.stringify(data), batchId).lastInsertRowid;
  }

  async flushBatches() {
    if (!dbManager.isAvailable()) return;

    // Find all un-sent batched notifications
    const recipients = dbManager.db.prepare(
      'SELECT DISTINCT recipient_id FROM notifications WHERE is_batched = 1 AND sent_at IS NULL'
    ).all();

    for (const r of recipients) {
      await notificationService.sendBatch(r.recipient_id);
    }
  }
}

export const smartNotificationEngine = new SmartNotificationEngine();
export default smartNotificationEngine;
