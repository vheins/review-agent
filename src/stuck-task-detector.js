import { dbManager } from './database.js';
import { logger } from './logger.js';
import { notificationService } from './notification-service.js';

export class StuckTaskDetector {
  constructor(timeoutHours = 1) {
    this.timeoutHours = timeoutHours;
  }

  async detectStuckTasks() {
    if (!dbManager.isAvailable()) return [];

    const timeoutMs = this.timeoutHours * 60 * 60 * 1000;
    const threshold = new Date(Date.now() - timeoutMs).toISOString();

    const stuckSessions = dbManager.db.prepare(`
      SELECT * FROM review_sessions 
      WHERE status = 'processing' AND started_at < ?
    `).all(threshold);

    logger.info(`Detected ${stuckSessions.length} stuck review sessions.`);

    for (const session of stuckSessions) {
      await this.recoverTask(session);
    }

    return stuckSessions;
  }

  async recoverTask(session) {
    const maxRetries = 3;

    if (session.retry_count < maxRetries) {
      logger.warn(`Recovering stuck task #${session.id}, attempt ${session.retry_count + 1}`);
      
      dbManager.db.prepare(`
        UPDATE review_sessions 
        SET status = 'pending', retry_count = retry_count + 1, 
            lock_owner = NULL, lock_timestamp = NULL
        WHERE id = ?
      `).run(session.id);
    } else {
      logger.error(`Task #${session.id} reached max retries. Marking as failed.`);
      
      dbManager.db.prepare(`
        UPDATE review_sessions SET status = 'failed' WHERE id = ?
      `).run(session.id);

      // Notify admins
      const admins = dbManager.db.prepare("SELECT id FROM developers WHERE role = 'admin'").all();
      for (const admin of admins) {
        await notificationService.sendNotification(
          admin.id,
          'task_failure',
          'Critical Task Failure',
          `Review session #${session.id} failed after ${maxRetries} retries.`,
          'urgent'
        );
      }
    }
  }
}

export const stuckTaskDetector = new StuckTaskDetector();
export default stuckTaskDetector;
