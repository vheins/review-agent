import { dbManager } from './database.js';

export class ChecklistManager {
  constructor() {}

  async createChecklist(repositoryId, name, description, items = []) {
    if (!dbManager.isAvailable()) throw new Error('Database not available');

    return dbManager.transaction(() => {
      const checklistId = dbManager.db.prepare(`
        INSERT INTO checklists (repository_id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(repositoryId, name, description).lastInsertRowid;

      const insertItem = dbManager.db.prepare(`
        INSERT INTO checklist_items (checklist_id, item_text, priority, category)
        VALUES (?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(checklistId, item.text, item.priority || 'normal', item.category);
      }

      return checklistId;
    })();
  }

  async getChecklistsForRepository(repositoryId) {
    if (!dbManager.isAvailable()) return [];

    return dbManager.db.prepare(`
      SELECT * FROM checklists 
      WHERE (repository_id = ? OR repository_id IS NULL) 
      AND is_active = 1
    `).all(repositoryId);
  }

  async getChecklistItems(checklistId) {
    if (!dbManager.isAvailable()) return [];

    return dbManager.db.prepare(`
      SELECT * FROM checklist_items WHERE checklist_id = ?
    `).all(checklistId);
  }

  async attachChecklistsToReview(reviewSessionId, repositoryId) {
    if (!dbManager.isAvailable()) return;

    const checklists = await this.getChecklistsForRepository(repositoryId);
    
    dbManager.transaction(() => {
      const insertReviewChecklist = dbManager.db.prepare(`
        INSERT OR IGNORE INTO review_checklists (review_session_id, checklist_item_id)
        VALUES (?, ?)
      `);

      for (const checklist of checklists) {
        const items = dbManager.db.prepare('SELECT id FROM checklist_items WHERE checklist_id = ?').all(checklist.id);
        for (const item of items) {
          insertReviewChecklist.run(reviewSessionId, item.id);
        }
      }
    })();
  }

  async completeItem(reviewSessionId, checklistItemId, developerId, notes = '') {
    if (!dbManager.isAvailable()) return;

    dbManager.db.prepare(`
      UPDATE review_checklists 
      SET is_completed = 1, completed_at = CURRENT_TIMESTAMP, 
          completed_by_developer_id = ?, notes = ?
      WHERE review_session_id = ? AND checklist_item_id = ?
    `).run(developerId, notes, reviewSessionId, checklistItemId);
  }

  async getReviewChecklistStatus(reviewSessionId) {
    if (!dbManager.isAvailable()) return null;

    const items = dbManager.db.prepare(`
      SELECT rc.*, ci.item_text, ci.priority, ci.category
      FROM review_checklists rc
      JOIN checklist_items ci ON rc.checklist_item_id = ci.id
      WHERE rc.review_session_id = ?
    `).all(reviewSessionId);

    if (items.length === 0) return null;

    const completed = items.filter(i => i.is_completed).length;
    const total = items.length;
    const completionPercentage = (completed / total) * 100;

    return {
      items,
      completed,
      total,
      completionPercentage
    };
  }
}

export const checklistManager = new ChecklistManager();
export default checklistManager;
