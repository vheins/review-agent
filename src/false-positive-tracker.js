import { dbManager } from './database.js';

export class FalsePositiveTracker {
  constructor() {}

  async markFalsePositive(commentId, developerId, justification) {
    if (!dbManager.isAvailable()) return null;

    return dbManager.transaction(() => {
      // Create false_positives record
      const result = dbManager.db.prepare(`
        INSERT INTO false_positives (comment_id, marked_by_developer_id, justification, marked_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(commentId, developerId, justification);

      // We need to update the false positive count on the review session
      const session = dbManager.db.prepare(`
        SELECT review_session_id FROM review_comments WHERE id = ?
      `).get(commentId);

      if (session) {
        dbManager.db.prepare(`
          UPDATE review_sessions 
          SET false_positive_count = false_positive_count + 1 
          WHERE id = ?
        `).run(session.review_session_id);
      }

      return result.lastInsertRowid;
    })();
  }

  async calculateFalsePositiveRates(filters = {}) {
    if (!dbManager.isAvailable()) return {};

    // Rate per executor
    let executorQuery = `
      SELECT 
        rs.executor_type,
        SUM(rs.false_positive_count) as total_false_positives,
        COUNT(rc.id) as total_comments
      FROM review_sessions rs
      LEFT JOIN review_comments rc ON rs.id = rc.review_session_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.startDate) {
      executorQuery += ' AND rs.completed_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      executorQuery += ' AND rs.completed_at <= ?';
      params.push(filters.endDate);
    }
    executorQuery += ' GROUP BY rs.executor_type';

    const executorStats = dbManager.db.prepare(executorQuery).all(...params);

    const ratesByExecutor = {};
    for (const stat of executorStats) {
      ratesByExecutor[stat.executor_type] = stat.total_comments > 0 
        ? stat.total_false_positives / stat.total_comments 
        : 0;
    }

    // Rate per issue category
    // This requires counting total comments of a type and how many of them are in false_positives
    let categoryQuery = `
      SELECT 
        rc.issue_type,
        COUNT(rc.id) as total_comments,
        SUM(CASE WHEN fp.id IS NOT NULL THEN 1 ELSE 0 END) as total_false_positives
      FROM review_comments rc
      LEFT JOIN false_positives fp ON rc.id = fp.comment_id
      JOIN review_sessions rs ON rc.review_session_id = rs.id
      WHERE 1=1
    `;
    
    if (filters.startDate) {
      categoryQuery += ' AND rs.completed_at >= ?';
    }
    if (filters.endDate) {
      categoryQuery += ' AND rs.completed_at <= ?';
    }
    categoryQuery += ' GROUP BY rc.issue_type';

    const categoryStats = dbManager.db.prepare(categoryQuery).all(...params);
    
    const ratesByCategory = {};
    for (const stat of categoryStats) {
      ratesByCategory[stat.issue_type] = stat.total_comments > 0
        ? stat.total_false_positives / stat.total_comments
        : 0;
    }

    return {
      ratesByExecutor,
      ratesByCategory
    };
  }
}

export const falsePositiveTracker = new FalsePositiveTracker();
export default falsePositiveTracker;
