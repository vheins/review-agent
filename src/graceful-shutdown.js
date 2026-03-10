import { dbManager } from './database.js';
import { logger } from './logger.js';

export class GracefulShutdown {
  constructor() {
    this.isShuttingDown = false;
    this.activeTasks = new Set();
  }

  init() {
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
  }

  trackTask(taskId) {
    this.activeTasks.add(taskId);
  }

  untrackTask(taskId) {
    this.activeTasks.delete(taskId);
  }

  async handleShutdown(signal) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.warn(`Received ${signal}. Starting graceful shutdown...`);

    // 1. Stop accepting new requests
    // (This would be handled in the main entry point by checking isShuttingDown)

    // 2. Wait for active tasks (with timeout)
    const shutdownTimeout = 30000; // 30s for this demo, usually longer for complex tasks
    const start = Date.now();

    while (this.activeTasks.size > 0 && (Date.now() - start) < shutdownTimeout) {
      logger.info(`Waiting for ${this.activeTasks.size} active tasks to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeTasks.size > 0) {
      logger.error(`Shutdown timeout reached. ${this.activeTasks.size} tasks still active. Marking as interrupted.`);
      await this.markInterruptedTasks();
    }

    // 3. Close resources
    await this.closeResources();

    logger.warn('Shutdown complete. Exiting.');
    process.exit(0);
  }

  async markInterruptedTasks() {
    if (!dbManager.isAvailable()) return;

    // Mark 'processing' sessions as 'failed' or 'interrupted'
    dbManager.db.prepare(`
      UPDATE review_sessions 
      SET status = 'failed', completed_at = CURRENT_TIMESTAMP 
      WHERE status = 'processing'
    `).run();
  }

  async closeResources() {
    if (dbManager.isAvailable()) {
      logger.info('Closing database connection...');
      dbManager.close();
    }
  }
}

export const gracefulShutdown = new GracefulShutdown();
export default gracefulShutdown;
