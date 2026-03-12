import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest } from '../../../database/entities/pull-request.entity.js';
import { Review } from '../../../database/entities/review.entity.js';
import { Comment } from '../../../database/entities/comment.entity.js';
import { RepositoryConfig } from '../../../database/entities/repository-config.entity.js';

@Injectable()
export class ConfidenceScorerService {
  private readonly logger = new Logger(ConfidenceScorerService.name);

  constructor(
    @InjectRepository(PullRequest)
    private readonly prRepository: Repository<PullRequest>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(RepositoryConfig)
    private readonly configRepository: Repository<RepositoryConfig>,
  ) {}

  /**
   * Calculate confidence score for a proposed action (e.g., auto-fix, merge)
   */
  async calculateConfidence(prNumber: number, repository: string, action: string): Promise<number> {
    this.logger.debug(`Calculating confidence for action ${action} on PR #${prNumber}`);
    
    // Confidence starts at 100
    let confidence = 100;

    // Simplified logic for MVP:
    // If action is 'merge', reduce confidence if PR impact is high
    if (action === 'merge') {
      const pr = await this.prRepository.findOne({ where: { number: prNumber, repository } });
      if (pr && pr.impact_score > 70) {
        confidence -= 30;
      }
    }

    // If action is 'auto-fix', reduce confidence if risk is high
    if (action === 'auto-fix' || action === 'fix') {
      const pr = await this.prRepository.findOne({ where: { number: prNumber, repository } });
      if (pr && pr.risk_score > 50) {
        confidence -= 40;
      }
    }

    return Math.max(0, confidence);
  }

  /**
   * Determine if an action should be gated (requires human override)
   */
  async shouldGateAction(prNumber: number, repository: string, action: string): Promise<boolean> {
    const config = await this.configRepository.findOne({ where: { repository } });
    
    let threshold = 80; // Default threshold
    if (config?.confidenceThresholds) {
      if (action === 'fix' || action === 'auto-fix') threshold = config.confidenceThresholds.fix ?? threshold;
      else if (action === 'merge') threshold = config.confidenceThresholds.merge ?? threshold;
      else if (action === 'resume') threshold = config.confidenceThresholds.resume ?? threshold;
    }

    const confidence = await this.calculateConfidence(prNumber, repository, action);
    return confidence < threshold;
  }
}
