import { dbManager } from './database.js';

export class AssignmentEngine {
  constructor() {}

  async calculateExpertiseScore(developerId, files = []) {
    if (!dbManager.isAvailable() || !files || files.length === 0) return 0;
    
    // Very basic expertise scoring based on expertise_areas table
    // A proper TF-IDF style algorithm would match file paths against patterns
    const expertiseAreas = dbManager.db.prepare(
      'SELECT file_pattern, expertise_score FROM expertise_areas WHERE developer_id = ?'
    ).all(developerId);
    
    if (expertiseAreas.length === 0) return 0;

    let totalScore = 0;
    for (const file of files) {
      for (const area of expertiseAreas) {
        // Simple string matching for now, could use regex/glob
        if (file.includes(area.file_pattern)) {
          totalScore += area.expertise_score;
        }
      }
    }
    
    return totalScore / files.length;
  }

  async calculateWorkloadScore(developerId) {
    if (!dbManager.isAvailable()) return 0;
    
    // Workload logic: 
    // 10 points for each pending review
    // 5 points for each authored PR still open (mental overhead)
    const pendingReviews = dbManager.db.prepare(
      "SELECT COUNT(*) as count FROM pr_reviewers WHERE developer_id = ? AND status = 'pending'"
    ).get(developerId).count;
    
    const authoredOpenPRs = dbManager.db.prepare(
      "SELECT COUNT(*) as count FROM pull_requests WHERE author_id = ? AND status = 'open'"
    ).get(developerId).count;
    
    return (pendingReviews * 10) + (authoredOpenPRs * 5);
  }

  async getWorkload(developerId) {
    const score = await this.calculateWorkloadScore(developerId);
    
    if (dbManager.isAvailable()) {
      dbManager.db.prepare(
        'UPDATE developers SET current_workload_score = ? WHERE id = ?'
      ).run(score, developerId);
    }
    
    return score;
  }

  async checkAvailability(developerId) {
    if (!dbManager.isAvailable()) return false;
    
    // First run restore to ensure any expired unavailability is cleared
    await this.restoreAvailability();
    
    const dev = dbManager.db.prepare(
      'SELECT is_available, unavailable_until FROM developers WHERE id = ?'
    ).get(developerId);
    
    if (!dev || !dev.is_available) return false;
    
    return true;
  }

  async setAvailability(developerId, isAvailable, unavailableUntil = null) {
    if (!dbManager.isAvailable()) return;
    
    dbManager.db.prepare(`
      UPDATE developers 
      SET is_available = ?, unavailable_until = ?
      WHERE id = ?
    `).run(isAvailable ? 1 : 0, unavailableUntil, developerId);
  }

  async restoreAvailability() {
    if (!dbManager.isAvailable()) return;
    
    const now = new Date().toISOString();

    dbManager.db.prepare(`
      UPDATE developers 
      SET is_available = 1, unavailable_until = NULL
      WHERE is_available = 0 
      AND unavailable_until IS NOT NULL 
      AND unavailable_until <= ?
    `).run(now);
  }

  async assignReviewers(prId, files = [], authorId = null) {
    if (!dbManager.isAvailable()) return [];

    const availableDevs = dbManager.db.prepare('SELECT id FROM developers WHERE is_available = 1 AND id != ?').all(authorId || 0);
    
    const candidates = [];
    for (const dev of availableDevs) {
      const isAvail = await this.checkAvailability(dev.id);
      if (isAvail) {
        const expertise = await this.calculateExpertiseScore(dev.id, files);
        const workload = await this.calculateWorkloadScore(dev.id);
        
        // Final score: high expertise is good, high workload is bad
        // Adjust weights as needed
        const score = (expertise * 0.7) - (workload * 0.3);
        candidates.push({ id: dev.id, score, workload });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    
    // Assign 1 to 3 reviewers
    const numReviewers = Math.max(1, Math.min(3, candidates.length));
    const selected = candidates.slice(0, numReviewers);
    
    // Update workloads and return assigned IDs
    return dbManager.transaction(() => {
      const assignedIds = [];
      const insertReviewer = dbManager.db.prepare(`
        INSERT OR IGNORE INTO pr_reviewers (pr_id, developer_id, assigned_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      
      const updateWorkload = dbManager.db.prepare(
        'UPDATE developers SET current_workload_score = ? WHERE id = ?'
      );
      
      for (const reviewer of selected) {
        insertReviewer.run(prId, reviewer.id);
        
        // Recalculate and update
        const pending = dbManager.db.prepare(
          "SELECT COUNT(*) as count FROM pr_reviewers WHERE developer_id = ? AND status = 'pending'"
        ).get(reviewer.id).count;
        const authored = dbManager.db.prepare(
          "SELECT COUNT(*) as count FROM pull_requests WHERE author_id = ? AND status = 'open'"
        ).get(reviewer.id).count;
        
        updateWorkload.run((pending * 10) + (authored * 5), reviewer.id);
        
        assignedIds.push(reviewer.id);
      }
      
      return assignedIds;
    })();
  }
  async updateExpertise(developerId, files = []) {
    if (!dbManager.isAvailable() || !files || files.length === 0) return;

    // Decay old expertise first
    dbManager.db.prepare(`
      UPDATE expertise_areas 
      SET expertise_score = expertise_score * 0.9 
      WHERE developer_id = ?
    `).run(developerId);

    // Update or insert new expertise based on file extensions/directories
    const patterns = new Set();
    for (const file of files) {
      const ext = file.split('.').pop();
      if (ext && ext !== file) {
        patterns.add(`*.${ext}`);
      }
      
      const dir = file.split('/').slice(0, -1).join('/');
      if (dir) {
        patterns.add(`${dir}/*`);
      }
    }

    const stmt = dbManager.db.prepare(`
      INSERT INTO expertise_areas (developer_id, file_pattern, expertise_score, last_contribution_at, contribution_count)
      VALUES (?, ?, 1.0, CURRENT_TIMESTAMP, 1)
      ON CONFLICT(developer_id, file_pattern) DO UPDATE SET
        expertise_score = expertise_score + 1.0,
        last_contribution_at = CURRENT_TIMESTAMP,
        contribution_count = contribution_count + 1
    `);

    dbManager.transaction(() => {
      for (const pattern of patterns) {
        stmt.run(developerId, pattern);
      }
    })();
  }
}

export const assignmentEngine = new AssignmentEngine();
export default assignmentEngine;
