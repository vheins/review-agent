import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueScore } from '../../../database/entities/queue-score.entity.js';
import { PullRequest } from '../../github/github.service.js';

@Injectable()
export class QueuePolicyEngine {
  private readonly logger = new Logger(QueuePolicyEngine.name);

  constructor(
    @InjectRepository(QueueScore)
    private readonly scoreRepository: Repository<QueueScore>,
  ) {}

  /**
   * Calculate and persist the score for a single PR
   */
  async calculateScore(pr: PullRequest): Promise<QueueScore> {
    this.logger.debug(`Calculating queue score for PR #${pr.number}`);
    // Skeleton implementation
    return {} as any;
  }

  /**
   * Trigger a complete queue re-scoring
   */
  async reScoreAll(repository?: string): Promise<void> {
    this.logger.log(`Re-scoring all PRs${repository ? ` for repository ${repository}` : ''}`);
  }

  /**
   * Get the current prioritized queue
   */
  async getQueue(repository?: string): Promise<QueueScore[]> {
    return this.scoreRepository.find({
      where: repository ? { repository } : {},
      order: { totalScore: 'DESC' },
      relations: ['pullRequest'],
    });
  }
}
