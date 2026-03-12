import { dbManager } from './database.js';

export class RejectionCategorizer {
  constructor() {
    this.categories = {
      security: ['vulnerability', 'auth', 'injection', 'secret', 'security', 'cve'],
      quality: ['complexity', 'style', 'performance', 'refactor', 'quality', 'logic', 'bug', 'error'],
      testing: ['test', 'coverage', 'mock', 'assertion', 'fixture'],
      documentation: ['doc', 'comment', 'readme', 'typing', 'type']
    };
  }

  categorizeComment(comment) {
    const issueType = (comment.issue_type || '').toLowerCase();
    const message = (comment.message || '').toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.categories)) {
      if (keywords.some(kw => issueType.includes(kw) || message.includes(kw))) {
        return category;
      }
    }
    
    return 'other';
  }

  categorizeReview(comments) {
    const reasons = new Set();
    for (const comment of comments) {
      // Only consider severe issues as rejection reasons, or if we want to be more inclusive, any issue
      if (['error', 'high', 'critical', 'warning'].includes(comment.severity?.toLowerCase())) {
        reasons.add(this.categorizeComment(comment));
      }
    }
    return Array.from(reasons);
  }

  async getRejectionFrequencies(filters = {}) {
    if (!dbManager.isAvailable()) return {};

    let query = `
      SELECT rs.rejection_reasons 
      FROM review_sessions rs
      JOIN pull_requests pr ON rs.pr_id = pr.id
      WHERE rs.outcome IN ('rejected', 'needs_changes')
    `;
    const params = [];
    
    if (filters.repository_id) {
      query += ` AND pr.repository_id = ?`;
      params.push(filters.repository_id);
    }
    if (filters.startDate) {
      query += ` AND rs.completed_at >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ` AND rs.completed_at <= ?`;
      params.push(filters.endDate);
    }
    
    const sessions = dbManager.db.prepare(query).all(...params);
    
    const frequencies = {};
    for (const session of sessions) {
      if (session.rejection_reasons) {
        try {
          const reasons = JSON.parse(session.rejection_reasons);
          if (Array.isArray(reasons)) {
            for (const reason of reasons) {
              frequencies[reason] = (frequencies[reason] || 0) + 1;
            }
          }
        } catch(e) {
          // ignore parsing errors
        }
      }
    }
    
    return frequencies;
  }
}

export const rejectionCategorizer = new RejectionCategorizer();
export default rejectionCategorizer;
