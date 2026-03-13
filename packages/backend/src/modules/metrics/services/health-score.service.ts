import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest } from '../../../database/entities/pull-request.entity.js';
import { SecurityFinding } from '../../../database/entities/security-finding.entity.js';
import { Review } from '../../../database/entities/review.entity.js';
import { Comment } from '../../../database/entities/comment.entity.js';
import { TestRun } from '../../../database/entities/test-run.entity.js';

/**
 * HealthScoreService - Service for calculating PR health scores
 * 
 * Requirements: 13.3
 */
@Injectable()
export class HealthScoreService {
  private readonly logger = new Logger(HealthScoreService.name);

  constructor(
    @InjectRepository(PullRequest)
    private readonly prRepository: Repository<PullRequest>,
    @InjectRepository(SecurityFinding)
    private readonly securityRepository: Repository<SecurityFinding>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(TestRun)
    private readonly testRunRepository: Repository<TestRun>,
  ) {}

  /**
   * Calculate health score for a Pull Request
   */
  async calculatePRHealthScore(prNumber: number, repository: string): Promise<any> {
    // Fetch review findings
    const findings = await this.securityRepository.find({ where: { prNumber, repository } });

    // Fetch reviews
    const reviews = await this.reviewRepository.find({ where: { prNumber, repository } });
    const reviewIds = reviews.map(r => r.id);
    
    let reviewComments: Comment[] = [];
    if (reviewIds.length > 0) {
      reviewComments = await this.commentRepository.createQueryBuilder('comment')
        .where('comment.review_id IN (:...reviewIds)', { reviewIds })
        .getMany();
    }

    // Fetch test results
    const lastTestRun = await this.testRunRepository.findOne({
      where: { prNumber, repository },
      order: { startedAt: 'DESC' }
    });

    const scores = this.calculateScores(findings, reviewComments, lastTestRun);

    await this.prRepository.update({ number: prNumber, repository }, {
      risk_score: 100 - scores.finalScore,
      updatedAt: new Date()
    });

    return scores;
  }

  private calculateScores(securityFindings: SecurityFinding[], reviewComments: Comment[], testRun: TestRun | null) {
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
        const results = typeof testRun.testResults === 'string' ? JSON.parse(testRun.testResults) : testRun.testResults;
        if (results && results.coverage) {
          testScore = results.coverage;
        }
      }
    } else {
      testScore = 50;
    }

    const finalScore = Math.round((securityScore * 0.4) + (reviewScore * 0.3) + (testScore * 0.3));

    return {
      securityScore,
      reviewScore,
      testScore,
      finalScore: Math.max(0, Math.min(100, finalScore))
    };
  }
}
