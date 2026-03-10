import { dbManager } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';

export class TaskLockManager {
  constructor(instanceId) {
    this.instanceId = instanceId || uuidv4();
    this.lockTimeoutMs = 60 * 60 * 1000; // 1 hour
  }

  async acquireLock(sessionId) {
    if (!dbManager.isAvailable()) return false;

    const now = new Date().toISOString();
    const timeoutThreshold = new Date(Date.now() - this.lockTimeoutMs).toISOString();

    // Optimistic locking: try to set lock_owner and lock_timestamp
    // only if they are NULL or if the lock has timed out
    const result = dbManager.db.prepare(`
      UPDATE review_sessions 
      SET lock_owner = ?, lock_timestamp = ? 
      WHERE id = ? AND (lock_owner IS NULL OR lock_timestamp < ?)
    `).run(this.instanceId, now, sessionId, timeoutThreshold);

    if (result.changes > 0) {
      logger.debug(`Lock acquired for session #${sessionId} by ${this.instanceId}`);
      return true;
    }

    return false;
  }

  async releaseLock(sessionId) {
    if (!dbManager.isAvailable()) return;

    dbManager.db.prepare(`
      UPDATE review_sessions 
      SET lock_owner = NULL, lock_timestamp = NULL 
      WHERE id = ? AND lock_owner = ?
    `).run(sessionId, this.instanceId);
    
    logger.debug(`Lock released for session #${sessionId} by ${this.instanceId}`);
  }

  async isLockedByMe(sessionId) {
    if (!dbManager.isAvailable()) return false;

    const session = dbManager.db.prepare(
      'SELECT lock_owner FROM review_sessions WHERE id = ?'
    ).get(sessionId);

    return session && session.lock_owner === this.instanceId;
  }
}

export const taskLockManager = new TaskLockManager(process.env.INSTANCE_ID);
export default taskLockManager;
