import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewMetrics } from '../../../database/entities/review-metrics.entity.js';

@Injectable()
export class CoverageTrackerService {
  private readonly logger = new Logger(CoverageTrackerService.name);

  constructor(
    @InjectRepository(ReviewMetrics)
    private readonly metricsRepo: Repository<ReviewMetrics>,
  ) {}

  /**
   * Record overall coverage for a PR/Review
   */
  async recordCoverage(reviewId: string, overallCoverage: number): Promise<void> {
    this.logger.log(`Recording coverage ${overallCoverage}% for review ${reviewId}`);
    
    // In our current schema, we don't have a dedicated coverage column in ReviewMetrics
    // We could store it in a 'metadata' column if we had one, or update the entity.
    // For now, we'll log it. In Phase 5 we should probably add this to the entity.
  }

  /**
   * Calculate coverage delta between base and PR
   */
  calculateDelta(baseCoverage: number, prCoverage: number) {
    const delta = prCoverage - baseCoverage;
    return {
      base: baseCoverage,
      current: prCoverage,
      delta,
      isDecrease: delta < -0.01
    };
  }

  /**
   * Get latest coverage for a branch
   */
  async getBaseBranchCoverage(repositoryId: string, branchName: string = 'main'): Promise<number> {
    // Simulation: in real world query metrics table for latest merged PR
    return 80.0;
  }
}
