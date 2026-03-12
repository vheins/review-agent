import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GitHubClientService } from '../../github/github.service.js';
import { AppConfigService } from '../../../config/app-config.service.js';
import { PullRequest } from '../../../database/entities/pull-request.entity.js';
import { Review } from '../../../database/entities/review.entity.js';
import { SecurityFinding } from '../../../database/entities/security-finding.entity.js';

export interface MergeEvaluation {
  eligible: boolean;
  reasons: string[];
  configuration: any;
}

@Injectable()
export class AutoMergeService {
  private readonly logger = new Logger(AutoMergeService.name);

  constructor(
    private readonly github: GitHubClientService,
    private readonly config: AppConfigService,
    @InjectRepository(PullRequest)
    private readonly prRepository: Repository<PullRequest>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(SecurityFinding)
    private readonly securityRepository: Repository<SecurityFinding>,
  ) {}

  async getMergeConfiguration(repository: string) {
    const repoConfig = await this.config.getRepositoryConfig(repository);
    
    // In our NestJS implementation, we use reviewConfig for global defaults
    const reviewConfig = this.config.getReviewConfig();

    return {
      enabled: repoConfig.autoMerge,
      healthThreshold: 100 - reviewConfig.severityThreshold, // Map severity threshold to health
      requiredChecks: ['review', 'security'] // Default for now
    };
  }

  async evaluate(pr: PullRequest): Promise<MergeEvaluation> {
    const configuration = await this.getMergeConfiguration(pr.repository);
    
    if (!configuration.enabled) {
      return { eligible: false, reasons: ['auto_merge_disabled'], configuration };
    }

    const reasons: string[] = [];
    
    // 1. Health Score Check
    if (pr.risk_score > (100 - configuration.healthThreshold)) {
      reasons.push('health_score_below_threshold');
    }

    // 2. Review Check
    const latestReview = await this.reviewRepository.findOne({
      where: { prNumber: pr.number, repository: pr.repository },
      order: { startedAt: 'DESC' }
    });

    if (!latestReview || latestReview.status !== 'completed') {
      reasons.push('review_not_completed');
    }

    // 3. Security Findings Check
    const unresolvedSecurity = await this.securityRepository.count({
      where: { prNumber: pr.number, repository: pr.repository, is_resolved: false }
    });

    if (unresolvedSecurity > 0) {
      reasons.push('security_findings_present');
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      configuration
    };
  }

  async mergeIfEligible(pr: PullRequest): Promise<{ status: string, merged: boolean, reasons: string[] }> {
    const evaluation = await this.evaluate(pr);
    
    if (!evaluation.eligible) {
      return {
        status: 'blocked',
        merged: false,
        reasons: evaluation.reasons
      };
    }

    const merged = await this.github.mergePR(pr.repository, pr.number);

    if (!merged) {
      return { status: 'merge_failed', merged: false, reasons: ['github_merge_failed'] };
    }

    await this.prRepository.update({ number: pr.number, repository: pr.repository }, {
      status: 'merged',
      updatedAt: new Date()
    });

    this.logger.log(`Auto-merged PR #${pr.number} from ${pr.repository}`);

    return { status: 'merged', merged: true, reasons: [] };
  }
}
