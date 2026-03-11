import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../database/entities/review.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';

/**
 * MetricsService - Service for calculating and tracking quality/performance metrics
 * 
 * Features:
 * - Review performance tracking (duration, issues)
 * - PR health score calculation
 * - AI review quality scoring
 * - Developer and repository stats aggregation
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(ReviewMetrics)
    private readonly metricsRepository: Repository<ReviewMetrics>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(PullRequest)
    private readonly prRepository: Repository<PullRequest>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(DeveloperMetrics)
    private readonly devMetricsRepository: Repository<DeveloperMetrics>,
  ) {}

  /**
   * Calculate quality score for a review session
   * 
   * Factors:
   * - Accuracy (False positive rate)
   * - Thoroughness (Variety of issues, critical issues found)
   * - Helpfulness (Suggested fixes provided)
   */
  calculateQualityScore(comments: Comment[], falsePositiveCount: number = 0): number {
    if (comments.length === 0) return 100;

    const accuracy = Math.max(0, 100 - (falsePositiveCount / comments.length * 200));
    
    const issueTypes = new Set(comments.map(c => c.category)).size;
    const thoroughness = Math.min(100, (issueTypes * 20) + (comments.length * 5));
    
    const fixes = comments.filter(c => !!c.suggestion).length;
    const helpfulness = (fixes / comments.length) * 100;

    // Weighted score: 50% accuracy, 30% thoroughness, 20% helpfulness
    return Math.round((accuracy * 0.5) + (thoroughness * 0.3) + (helpfulness * 0.2));
  }

  /**
   * Calculate health score for a Pull Request
   */
  calculateHealthScore(securityFindings: any[], reviewComments: Comment[]): number {
    let securityScore = 100;
    for (const f of securityFindings) {
      if (f.severity === 'critical') securityScore -= 30;
      else if (f.severity === 'high') securityScore -= 15;
      else if (f.severity === 'medium') securityScore -= 5;
    }
    securityScore = Math.max(0, securityScore);

    let reviewScore = 100;
    for (const c of reviewComments) {
      if (c.severity === 'error') reviewScore -= 10;
      else if (c.severity === 'warning') reviewScore -= 5;
    }
    reviewScore = Math.max(0, reviewScore);

    // Weighted Score: 60% Security, 40% Review Quality (simplified for now)
    return Math.round((securityScore * 0.6) + (reviewScore * 0.4));
  }

  /**
   * Aggregates and updates developer metrics
   */
  async updateDeveloperStats(author: string): Promise<void> {
    const prs = await this.prRepository.find({ where: { author }, relations: ['reviews'] });
    if (prs.length === 0) return;

    let totalScore = 0;
    let totalPRs = prs.length;

    for (const pr of prs) {
      if (pr.reviews && pr.reviews.length > 0) {
        const latestReview = pr.reviews.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
        const metrics = await this.metricsRepository.findOne({ where: { reviewId: latestReview.id } });
        if (metrics) totalScore += metrics.healthScore;
      }
    }

    const avgScore = totalPRs > 0 ? totalScore / totalPRs : 0;

    let devMetrics = await this.devMetricsRepository.findOne({ where: { username: author } });
    if (!devMetrics) {
      devMetrics = this.devMetricsRepository.create({
        username: author,
        reviewedPrs: totalPRs,
        totalPrs: totalPRs, // Using totalPRs as a placeholder
        averageHealthScore: avgScore,
        averageQualityScore: 0,
        averageReviewTime: 0,
        issuesFound: { bugs: 0, security: 0, performance: 0, maintainability: 0 },
      });
    } else {
      devMetrics.reviewedPrs = totalPRs;
      devMetrics.averageHealthScore = avgScore;
    }

    await this.devMetricsRepository.save(devMetrics);
  }
}
