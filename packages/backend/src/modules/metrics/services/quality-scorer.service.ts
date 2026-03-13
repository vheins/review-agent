import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Review } from '../../../database/entities/review.entity.js';
import { ReviewMetrics } from '../../../database/entities/review-metrics.entity.js';
import { Comment } from '../../../database/entities/comment.entity.js';
import { ChecklistService } from '../../review/checklist.service.js';

/**
 * QualityScorerService - Service for scoring review quality
 * 
 * Requirements: 13.2
 */
@Injectable()
export class QualityScorerService {
  private readonly logger = new Logger(QualityScorerService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(ReviewMetrics)
    private readonly metricsRepository: Repository<ReviewMetrics>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly checklistManager: ChecklistService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Score a review session based on comments and accuracy
   */
  async scoreReview(reviewId: string): Promise<any> {
    const comments = await this.commentRepository.find({
      where: { reviewId }
    });

    const falsePositives = await this.dataSource.query(`
      SELECT id FROM comments 
      WHERE review_id = ? AND is_false_positive = 1
    `, [reviewId]);

    const checklistStatus = await this.checklistManager.getReviewChecklistStatus(reviewId);

    const scoreDetails = this.calculateScores(comments, falsePositives.length, checklistStatus);

    // Update metrics instead of review directly
    await this.metricsRepository.update({ reviewId }, {
      qualityScore: scoreDetails.finalScore,
    });

    return scoreDetails;
  }

  private calculateScores(comments: Comment[], falsePositiveCount: number, checklistStatus: any = null) {
    const thoroughness = this.calculateThoroughness(comments);
    const helpfulness = this.calculateHelpfulness(comments);
    const accuracy = this.calculateAccuracy(comments, falsePositiveCount);

    let checklistScore = 100;
    if (checklistStatus) {
      checklistScore = checklistStatus.completionPercentage;
    }

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

  private calculateThoroughness(comments: Comment[]) {
    const totalComments = comments.length;
    if (totalComments === 0) return 50;

    const issueTypes = new Set(comments.map(c => c.category));
    const criticalCount = comments.filter(c => c.severity === 'critical' || c.severity === 'error').length;
    const highCount = comments.filter(c => c.severity === 'high' || c.severity === 'warning').length;
    
    const varietyScore = Math.min(40, issueTypes.size * 10);
    const severityScore = Math.min(60, (criticalCount * 15) + (highCount * 5) + (totalComments * 2));
    
    return varietyScore + severityScore;
  }

  private calculateHelpfulness(comments: Comment[]) {
    const totalComments = comments.length;
    if (totalComments === 0) return 50;

    const actionableCount = comments.filter(c => c.suggestion).length;
    const detailedMessages = comments.filter(c => c.message && c.message.length > 50).length;
    
    const actionableScore = (actionableCount / totalComments) * 60;
    const detailScore = (detailedMessages / totalComments) * 40;
    
    return actionableScore + detailScore;
  }

  private calculateAccuracy(comments: Comment[], falsePositiveCount: number) {
    const totalComments = comments.length;
    if (totalComments === 0) return 100;
    
    const fpRate = falsePositiveCount / totalComments;
    return Math.max(0, 100 - (fpRate * 100 * 2));
  }
}
