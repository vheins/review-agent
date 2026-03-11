import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeveloperMetrics } from '../../../database/entities/developer-metrics.entity.js';

@Injectable()
export class AssignmentEngineService {
  private readonly logger = new Logger(AssignmentEngineService.name);

  constructor(
    @InjectRepository(DeveloperMetrics)
    private readonly devMetricsRepo: Repository<DeveloperMetrics>,
  ) {}

  /**
   * Suggest reviewers for a PR based on expertise and workload
   */
  async suggestReviewers(repoName: string, prNumber: number, files: string[], author: string): Promise<string[]> {
    this.logger.log(`Suggesting reviewers for ${repoName}#${prNumber}`);
    
    // Fetch all developers
    const allDevs = await this.devMetricsRepo.find();
    
    // Filter out author
    const candidates = allDevs.filter(d => d.developerId !== author);
    
    if (candidates.length === 0) return [];

    // Simple sorting by total PRs reviewed (experience)
    candidates.sort((a, b) => b.totalPrsReviewed - a.totalPrsReviewed);
    
    // Return top 2 candidates
    return candidates.slice(0, 2).map(d => d.developerId);
  }
}
