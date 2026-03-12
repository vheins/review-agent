import { dbManager } from './database.js';

export class ElapsedTimeTracker {
  constructor() {}

  async calculateElapsedTime(prId) {
    if (!dbManager.isAvailable()) return null;

    const pr = dbManager.db.prepare('SELECT created_at, status FROM pull_requests WHERE id = ?').get(prId);
    if (!pr) return null;

    const now = new Date();
    const createdAt = new Date(pr.created_at);
    const elapsedSeconds = Math.floor((now - createdAt) / 1000);

    return {
      prId,
      status: pr.status,
      elapsedSeconds,
      createdAt: pr.created_at
    };
  }

  // To truly track time in each status, we would need a status_history table.
  // Since we don't have it, we calculate elapsed time globally for the PR
  // Or we use updated_at to track time in the current status.
  async calculateTimeInCurrentStatus(prId) {
    if (!dbManager.isAvailable()) return null;

    const pr = dbManager.db.prepare('SELECT updated_at, status FROM pull_requests WHERE id = ?').get(prId);
    if (!pr) return null;

    const now = new Date();
    const updatedAt = new Date(pr.updated_at);
    const elapsedSeconds = Math.floor((now - updatedAt) / 1000);

    return {
      prId,
      status: pr.status,
      timeInStatusSeconds: elapsedSeconds,
      statusSince: pr.updated_at
    };
  }
}

export const elapsedTimeTracker = new ElapsedTimeTracker();
export default elapsedTimeTracker;
