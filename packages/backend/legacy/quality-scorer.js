import { dbManager } from './database.js';
import { checklistManager } from './checklist-manager.js';

export class QualityScorer {
  constructor() {}

  async scoreReview(reviewSessionId) {
    if (!dbManager.isAvailable()) return null;

    // Fetch review comments for this session
    const comments = dbManager.db.prepare(
      'SELECT id, issue_type, severity, message, suggested_fix, is_auto_fixable FROM review_comments WHERE review_session_id = ?'
    ).all(reviewSessionId);

    // Fetch false positives marked against this session
    const falsePositives = dbManager.db.prepare(`
      SELECT fp.id FROM false_positives fp
      JOIN review_comments rc ON fp.comment_id = rc.id
      WHERE rc.review_session_id = ?
    `).all(reviewSessionId);

    // Fetch checklist status
    const checklistStatus = await checklistManager.getReviewChecklistStatus(reviewSessionId);

    const scoreDetails = this.calculateScores(comments, falsePositives.length, checklistStatus);

    // Store quality score
    dbManager.db.prepare(
      'UPDATE review_sessions SET quality_score = ?, false_positive_count = ? WHERE id = ?'
    ).run(scoreDetails.finalScore, falsePositives.length, reviewSessionId);

    return scoreDetails;
  }

  calculateScores(comments, falsePositiveCount, checklistStatus = null) {
    const totalComments = comments.length;
    
    // ... existing components ...
    // Accuracy is most important (50%), then Thoroughness (30%), Helpfulness (20%)
    
    // NEW: Checklist completeness (if applicable)
    let checklistScore = 100;
    if (checklistStatus) {
      checklistScore = checklistStatus.completionPercentage;
    }

    // Recalculate component scores
    const thoroughness = this.calculateThoroughness(comments);
    const helpfulness = this.calculateHelpfulness(comments);
    const accuracy = this.calculateAccuracy(comments, falsePositiveCount);

    // Weighted Final Score
    // If checklist exists, it takes 20% weight, shifting others
    let finalScore;
    if (checklistStatus) {
      finalScore = Math.round(
        (accuracy * 0.4) + 
        (thoroughness * 0.2) + 
        (helpfulness * 0.2) + 
        (checklistScore * 0.2)
      );
    } else {
      finalScore = Math.round((accuracy * 0.5) + (thoroughness * 0.3) + (helpfulness * 0.2));
    }

    return {
      thoroughness: Math.round(thoroughness),
      helpfulness: Math.round(helpfulness),
      accuracy: Math.round(accuracy),
      checklist: checklistStatus ? Math.round(checklistScore) : null,
      finalScore: Math.max(0, Math.min(100, finalScore))
    };
  }

  calculateThoroughness(comments) {
    const totalComments = comments.length;
    if (totalComments === 0) return 50;

    const issueTypes = new Set(comments.map(c => c.issue_type));
    const criticalCount = comments.filter(c => c.severity === 'critical' || c.severity === 'error').length;
    const highCount = comments.filter(c => c.severity === 'high' || c.severity === 'warning').length;
    
    const varietyScore = Math.min(40, issueTypes.size * 10);
    const severityScore = Math.min(60, (criticalCount * 15) + (highCount * 5) + (totalComments * 2));
    
    return varietyScore + severityScore;
  }

  calculateHelpfulness(comments) {
    const totalComments = comments.length;
    if (totalComments === 0) return 50;

    const actionableCount = comments.filter(c => c.suggested_fix || c.is_auto_fixable).length;
    const detailedMessages = comments.filter(c => c.message && c.message.length > 50).length;
    
    const actionableScore = (actionableCount / totalComments) * 60;
    const detailScore = (detailedMessages / totalComments) * 40;
    
    return actionableScore + detailScore;
  }

  calculateAccuracy(comments, falsePositiveCount) {
    const totalComments = comments.length;
    if (totalComments === 0) return 100;
    
    const fpRate = falsePositiveCount / totalComments;
    return Math.max(0, 100 - (fpRate * 100 * 2));
  }

  async getQualityTrends(filters = {}) {
    if (!dbManager.isAvailable()) return [];

    let query = `
      SELECT 
        strftime('%Y-%m-%d', completed_at) as bucket,
        executor_type,
        AVG(quality_score) as avg_score,
        COUNT(*) as session_count
      FROM review_sessions
      WHERE status = 'completed' AND quality_score IS NOT NULL
    `;
    const params = [];

    if (filters.executor_type) {
      query += ' AND executor_type = ?';
      params.push(filters.executor_type);
    }
    if (filters.startDate) {
      query += ' AND completed_at >= ?';
      params.push(filters.startDate);
    }

    query += ' GROUP BY bucket, executor_type ORDER BY bucket ASC';

    const rawData = dbManager.db.prepare(query).all(...params);
    
    // Group by executor for trend analysis
    const trendsByExecutor = {};
    for (const row of rawData) {
      if (!trendsByExecutor[row.executor_type]) {
        trendsByExecutor[row.executor_type] = [];
      }
      trendsByExecutor[row.executor_type].push(row);
    }

    const results = [];
    for (const [executor, data] of Object.entries(trendsByExecutor)) {
      if (data.length < 2) {
        results.push({
          executor,
          trend: 'stable',
          change: 0,
          current_avg: data.length === 1 ? data[0].avg_score : 0,
          data
        });
        continue;
      }

      const last = data[data.length - 1].avg_score;
      const prev = data[data.length - 2].avg_score;
      const change = last - prev;

      results.push({
        executor,
        trend: change > 2 ? 'improving' : (change < -2 ? 'degrading' : 'stable'),
        change,
        current_avg: last,
        data
      });
    }

    return results;
  }
}

export const qualityScorer = new QualityScorer();
export default qualityScorer;
