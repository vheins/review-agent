import { dbManager } from './database.js';

export class ReviewQueue {
  constructor() {}

  async calculateInitialPriority(pr) {
    let score = 0;
    
    // Base score
    score += 10;
    
    if (pr.is_blocking) {
      score += 50;
    }
    
    return score;
  }

  async getQueue() {
    if (!dbManager.isAvailable()) return [];
    
    // Sort queue by priority score descending
    return dbManager.db.prepare(
      'SELECT * FROM pull_requests WHERE status = ? ORDER BY priority_score DESC, created_at ASC'
    ).all('open');
  }

  async updatePriorityScores() {
    if (!dbManager.isAvailable()) return;

    // Aging: +10 points per day since creation
    // SLA proximity: additional points if approaching or exceeding SLA
    // For simplicity, we just calculate days since creation and update
    
    const prs = dbManager.db.prepare(
      'SELECT id, created_at, is_blocking FROM pull_requests WHERE status = ?'
    ).all('open');
    
    const updateStmt = dbManager.db.prepare(
      'UPDATE pull_requests SET priority_score = ? WHERE id = ?'
    );

    const now = new Date();

    dbManager.transaction(() => {
      for (const pr of prs) {
        const createdAt = new Date(pr.created_at);
        const daysOld = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        
        let newScore = 10; // base
        if (pr.is_blocking) newScore += 50;
        
        newScore += Math.max(0, daysOld) * 10; // Aging
        
        updateStmt.run(newScore, pr.id);
      }
    })();
  }
}

export const reviewQueue = new ReviewQueue();
export default reviewQueue;
