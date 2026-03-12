import { dbManager } from './database.js';

export class FeedbackAnalyzer {
  constructor() {
    this.positiveKeywords = ['good', 'great', 'excellent', 'nice', 'clean', 'thanks', 'thank you', 'agree'];
    this.negativeKeywords = ['bad', 'poor', 'slow', 'wrong', 'fix', 'error', 'bug', 'complexity', 'complex'];
    this.constructiveKeywords = ['suggest', 'consider', 'maybe', 'perhaps', 'how about', 'instead'];
  }

  async analyzeDeveloperFeedback(developerId) {
    if (!dbManager.isAvailable()) return null;

    // Get all comments written BY this developer (if we tracked that)
    // Actually, requirements often mean feedback RECEIVED by the developer.
    // Let's assume feedback RECEIVED on their PRs.
    
    const comments = dbManager.db.prepare(`
      SELECT rc.* FROM review_comments rc
      JOIN review_sessions rs ON rc.review_session_id = rs.id
      JOIN pull_requests pr ON rs.pr_id = pr.id
      WHERE pr.author_id = ?
    `).all(developerId);

    const analysis = {
      totalComments: comments.length,
      sentiment: {
        positive: 0,
        negative: 0,
        neutral: 0
      },
      constructiveCount: 0,
      commonIssues: {},
      improvementAreas: []
    };

    for (const c of comments) {
      const msg = c.message.toLowerCase();
      
      let pos = this.positiveKeywords.filter(k => msg.includes(k)).length;
      let neg = this.negativeKeywords.filter(k => msg.includes(k)).length;
      let cons = this.constructiveKeywords.filter(k => msg.includes(k)).length;

      if (pos > neg) analysis.sentiment.positive++;
      else if (neg > pos) analysis.sentiment.negative++;
      else analysis.sentiment.neutral++;

      if (cons > 0) analysis.constructiveCount++;

      analysis.commonIssues[c.issue_type] = (analysis.commonIssues[c.issue_type] || 0) + 1;
    }

    // Identify top 3 improvement areas
    analysis.improvementAreas = Object.entries(analysis.commonIssues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);

    return analysis;
  }

  async generateFeedbackReport(developerId) {
    const analysis = await this.analyzeDeveloperFeedback(developerId);
    if (!analysis) return 'No feedback data found.';

    let report = `# Feedback Analysis Report\n\n`;
    report += `## Sentiment Overview\n`;
    report += `- Positive: ${analysis.sentiment.positive}\n`;
    report += `- Neutral: ${analysis.sentiment.neutral}\n`;
    report += `- Negative: ${analysis.sentiment.negative}\n\n`;

    report += `## Constructiveness\n`;
    report += `- Constructive Comments: ${analysis.constructiveCount} (${((analysis.constructiveCount / analysis.totalComments) * 100).toFixed(1)}%)\n\n`;

    report += `## Areas for Growth\n`;
    for (const area of analysis.improvementAreas) {
      report += `- **${area.toUpperCase()}**: Frequent feedback received in this category.\n`;
    }

    return report;
  }
}

export const feedbackAnalyzer = new FeedbackAnalyzer();
export default feedbackAnalyzer;
