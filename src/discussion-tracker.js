import { dbManager } from './database.js';
import { v4 as uuidv4 } from 'uuid';

export class DiscussionTracker {
  constructor() {}

  async syncThreads(prId, threads = []) {
    if (!dbManager.isAvailable()) return;

    dbManager.transaction(() => {
      const upsertStmt = dbManager.db.prepare(`
        INSERT INTO pr_discussions (
          id, pr_id, github_thread_id, author_id, body, status, 
          is_resolved, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          body = excluded.body,
          status = excluded.status,
          is_resolved = excluded.is_resolved,
          updated_at = CURRENT_TIMESTAMP
      `);

      for (const thread of threads) {
        // thread: { id, github_thread_id, author_id, body, status, is_resolved }
        const id = thread.id || uuidv4();
        upsertStmt.run(
          id, prId, thread.github_thread_id, thread.author_id, 
          thread.body, thread.status || 'open', 
          thread.is_resolved ? 1 : 0
        );
      }
    })();
  }

  async resolveThread(discussionId, developerId) {
    if (!dbManager.isAvailable()) return;

    dbManager.db.prepare(`
      UPDATE pr_discussions 
      SET status = 'resolved', is_resolved = 1, 
          resolved_at = CURRENT_TIMESTAMP, 
          resolved_by_developer_id = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(developerId, discussionId);
  }

  async getUnresolvedThreads(prId) {
    if (!dbManager.isAvailable()) return [];

    return dbManager.db.prepare(
      'SELECT * FROM pr_discussions WHERE pr_id = ? AND is_resolved = 0'
    ).all(prId);
  }
}

export const discussionTracker = new DiscussionTracker();
export default discussionTracker;
