import { dbManager } from './database.js';

export class HealthScoreCalculator {
  constructor() {}

  async calculatePRHealthScore(prId) {
    if (!dbManager.isAvailable()) return null;

    // Fetch review findings
    const findings = dbManager.db.prepare(`
      SELECT severity, finding_type FROM security_findings WHERE pr_id = ?
    `).all(prId);

    const reviewComments = dbManager.db.prepare(`
      SELECT rc.severity FROM review_comments rc
      JOIN review_sessions rs ON rc.review_session_id = rs.id
      WHERE rs.pr_id = ?
    `).all(prId);

    // Fetch test results
    const lastTestRun = dbManager.db.prepare(`
      SELECT status, test_results FROM test_runs 
      WHERE pr_id = ? ORDER BY started_at DESC LIMIT 1
    `).get(prId);

    const scores = this.calculateScores(findings, reviewComments, lastTestRun);

    dbManager.db.prepare('UPDATE pull_requests SET health_score = ? WHERE id = ?')
      .run(scores.finalScore, prId);

    return scores;
  }

  calculateScores(securityFindings, reviewComments, testRun) {
    // 1. Security Score (0-100)
    let securityScore = 100;
    for (const f of securityFindings) {
      if (f.severity === 'critical') securityScore -= 30;
      else if (f.severity === 'high') securityScore -= 15;
      else if (f.severity === 'medium') securityScore -= 5;
    }
    securityScore = Math.max(0, securityScore);

    // 2. Review Quality Score (0-100)
    let reviewScore = 100;
    for (const c of reviewComments) {
      if (c.severity === 'error') reviewScore -= 10;
      else if (c.severity === 'warning') reviewScore -= 5;
    }
    reviewScore = Math.max(0, reviewScore);

    // 3. Test Score (0-100)
    let testScore = 100;
    if (testRun) {
      if (testRun.status === 'failed') testScore = 0;
      else if (testRun.status === 'passed') {
        try {
          const results = JSON.parse(testRun.test_results || '{}');
          if (results.coverage) {
            testScore = results.coverage; // Use coverage % directly
          }
        } catch(e) {}
      }
    } else {
      testScore = 50; // Neutral if no tests run yet
    }

    // Weighted Final Score
    // Security: 40%, Review: 30%, Tests: 30%
    const finalScore = Math.round((securityScore * 0.4) + (reviewScore * 0.3) + (testScore * 0.3));

    return {
      securityScore,
      reviewScore,
      testScore,
      finalScore: Math.max(0, Math.min(100, finalScore))
    };
  }
}

export const healthScoreCalculator = new HealthScoreCalculator();
export default healthScoreCalculator;
