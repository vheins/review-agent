import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../../../database/entities/comment.entity.js';
import { Review } from '../../../database/entities/review.entity.js';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly positiveKeywords = ['good', 'great', 'excellent', 'nice', 'clean', 'thanks', 'thank you', 'agree'];
  private readonly negativeKeywords = ['bad', 'poor', 'slow', 'wrong', 'fix', 'error', 'bug', 'complexity', 'complex'];
  private readonly constructiveKeywords = ['suggest', 'consider', 'maybe', 'perhaps', 'how about', 'instead'];

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  async analyzeDeveloperFeedback(developerUsername: string) {
    // In our NestJS implementation, PullRequest has author (string username)
    const comments = await this.commentRepository.find({
      where: {
        review: {
          pullRequest: {
            author: developerUsername
          }
        }
      },
      relations: ['review', 'review.pullRequest']
    });

    const analysis: any = {
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

      analysis.commonIssues[c.category] = (analysis.commonIssues[c.category] || 0) + 1;
    }

    analysis.improvementAreas = Object.entries(analysis.commonIssues)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);

    return analysis;
  }

  async generateFeedbackReport(developerUsername: string): Promise<string> {
    const analysis = await this.analyzeDeveloperFeedback(developerUsername);
    if (!analysis || analysis.totalComments === 0) return 'No feedback data found.';

    let report = `# Feedback Analysis Report for ${developerUsername}\n\n`;
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
