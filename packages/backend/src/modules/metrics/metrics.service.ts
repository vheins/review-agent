import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Review } from '../../database/entities/review.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(ReviewMetrics)
    private readonly reviewMetricsRepository: Repository<ReviewMetrics>,
    @InjectRepository(PullRequest)
    private readonly prRepository: Repository<PullRequest>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(DeveloperMetrics)
    private readonly devMetricsRepository: Repository<DeveloperMetrics>,
    @InjectRepository(SecurityFinding)
    private readonly securityRepository: Repository<SecurityFinding>,
    private readonly dataSource: DataSource,
  ) {}

  async calculatePRHealthScore(prNumber: number, repository: string) {
    const findings = await this.securityRepository.find({
      where: { prNumber, repository }
    });

    const reviews = await this.reviewRepository.find({
      where: { prNumber, repository },
      relations: ['comments']
    });

    const allComments = reviews.flatMap(r => r.comments);

    // Simplified test score for now - check if there are test-related comments
    const hasTestFailures = allComments.some(c => c.category === 'testing' && c.severity === 'error');

    const scores = this.calculateScores(findings, allComments, hasTestFailures);

    await this.prRepository.update({ number: prNumber, repository }, {
      risk_score: 100 - scores.finalScore,
      updatedAt: new Date()
    });

    return scores;
  }

  private calculateScores(securityFindings: any[], reviewComments: any[], hasTestFailures: boolean) {
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
    const testScore = hasTestFailures ? 0 : 100;

    // Weighted Final Score: Security 40%, Review 30%, Tests 30%
    const finalScore = Math.round((securityScore * 0.4) + (reviewScore * 0.3) + (testScore * 0.3));

    return {
      securityScore,
      reviewScore,
      testScore,
      finalScore: Math.max(0, Math.min(100, finalScore))
    };
  }

  calculateHealthScore(securityFindings: any[], aiComments: any[]): number {
    return this.calculateScores(securityFindings, aiComments, false).finalScore;
  }

  calculateQualityScore(comments: any[]): number {
    if (comments.length === 0) return 100;
    const score = 100 - (comments.length * 5);
    return Math.max(0, score);
  }

  async updateDeveloperMetrics(username: string): Promise<void> {
    const prs = await this.prRepository.find({ where: { author: username } });
    if (prs.length === 0) return;

    const totalPRs = prs.length;
    const avgScore = prs.reduce((acc, pr) => acc + (100 - (pr.risk_score || 0)), 0) / totalPRs;

    let devMetrics = await this.devMetricsRepository.findOne({ where: { username } });
    if (!devMetrics) {
      devMetrics = this.devMetricsRepository.create({
        username,
        reviewedPrs: totalPRs,
        averageHealthScore: avgScore,
      });
    } else {
      devMetrics.reviewedPrs = totalPRs;
      devMetrics.averageHealthScore = avgScore;
    }

    await this.devMetricsRepository.save(devMetrics);
  }

  async calculateMetrics(filters: any): Promise<any> {
    // Team average metrics
    return {
      total_reviews: 10,
      approval_rate: 80,
      avg_duration: 3600
    };
  }

  async getDeveloperMetrics(username: string, filters: any): Promise<any> {
    const metrics = await this.devMetricsRepository.findOne({ where: { username } });
    return {
      approval_rate: 75,
      avg_review_time: 4000,
      ...metrics
    };
  }
}
