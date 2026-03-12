import { dbManager } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import { assignmentEngine } from './assignment-engine.js';

export class OrchestrationSetManager {
  constructor() {}

  async createSet(name, description, prs = []) {
    if (!dbManager.isAvailable()) throw new Error('Database not available');

    const setId = uuidv4();

    return dbManager.transaction(() => {
      dbManager.db.prepare(`
        INSERT INTO orchestration_sets (id, name, description, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(setId, name, description);

      const insertMember = dbManager.db.prepare(`
        INSERT INTO orchestration_set_members (set_id, pr_id, dependency_pr_id)
        VALUES (?, ?, ?)
      `);

      for (const member of prs) {
        // member: { pr_id, dependency_pr_id }
        insertMember.run(setId, member.pr_id, member.dependency_pr_id || null);
      }

      return setId;
    })();
  }

  async getSetStatus(setId) {
    if (!dbManager.isAvailable()) return null;

    const set = dbManager.db.prepare('SELECT * FROM orchestration_sets WHERE id = ?').get(setId);
    if (!set) return null;

    const members = dbManager.db.prepare(`
      SELECT osm.*, pr.title, pr.status 
      FROM orchestration_set_members osm
      JOIN pull_requests pr ON osm.pr_id = pr.id
      WHERE osm.set_id = ?
    `).all(setId);

    const completed = members.filter(m => m.status === 'merged' || m.status === 'closed').length;
    const total = members.length;

    return {
      ...set,
      members,
      completedCount: completed,
      totalCount: total,
      progress: total > 0 ? (completed / total) * 100 : 0
    };
  }

  async assignReviewersToSet(setId, reviewerIds) {
    if (!dbManager.isAvailable()) return;

    const members = dbManager.db.prepare('SELECT pr_id FROM orchestration_set_members WHERE set_id = ?').all(setId);
    
    dbManager.transaction(() => {
      const insertReviewer = dbManager.db.prepare(`
        INSERT OR IGNORE INTO pr_reviewers (pr_id, developer_id, assigned_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);

      for (const member of members) {
        for (const reviewerId of reviewerIds) {
          insertReviewer.run(member.pr_id, reviewerId);
        }
      }
    })();
  }
}

export const orchestrationSetManager = new OrchestrationSetManager();
export default orchestrationSetManager;
