import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GitHubClientService, PullRequest } from '../github/github.service.js';
import { AiExecutorService } from '../ai/ai-executor.service.js';
import { ReviewGateway } from '../websocket/review.gateway.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { Review } from '../../database/entities/review.entity.js';
import { PullRequest as PullRequestEntity } from '../../database/entities/pull-request.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';

/**
 * ReviewEngineService - Core service for orchestrating PR reviews
 * 
 * This service coordinates GitHub operations, AI analysis, and database storage.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
@Injectable()
export class ReviewEngineService {
  private readonly logger = new Logger(ReviewEngineService.name);

  constructor(
    private readonly github: GitHubClientService,
    private readonly ai: AiExecutorService,
    private readonly gateway: ReviewGateway,
    private readonly config: AppConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(PullRequestEntity)
    private readonly prRepository: Repository<PullRequestEntity>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(ReviewMetrics)
    private readonly metricsRepository: Repository<ReviewMetrics>,
  ) {}

  /**
   * Process and review a single Pull Request
   * 
   * @param pr - Pull Request metadata
   * @returns Success status
   * 
   * Requirements: 7.2, 7.3
   */
  async reviewPullRequest(pr: PullRequest): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const startTime = Date.now();

    try {
      this.logger.log(`Starting review for PR #${pr.number}: ${pr.title}`);
      this.gateway.broadcastReviewStarted(pr.number, pr.repository.nameWithOwner);

      // 1. Prepare repository
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 10, 'Preparing repository...');
      const repoDir = await this.github.prepareRepository(pr);
      
      // 2. Get diff
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 25, 'Fetching diff...');
      const { stdout: diff } = await this.github.execaVerbose('git', ['diff', `${pr.baseRefName}...${pr.headRefName}`], { cwd: repoDir });
      
      if (!diff) {
        this.logger.warn(`No diff found for PR #${pr.number}, skipping review.`);
        this.gateway.broadcastReviewCompleted(pr.number, pr.repository.nameWithOwner, { status: 'skipped', reason: 'no diff' });
        await queryRunner.rollbackTransaction();
        return true;
      }

      // 3. AI Review
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 40, 'Executing AI review...');
      const comments = await this.ai.executeReview(pr, diff, repoDir);
      
      // 4. Calculate metrics and decision
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 70, 'Analyzing findings...');
      const issuesFound = {
        bugs: comments.filter(c => c.issue_type === 'logic').length,
        security: comments.filter(c => c.issue_type === 'security').length,
        performance: 0,
        maintainability: comments.filter(c => c.issue_type === 'quality').length,
        architecture: 0,
        testing: 0,
      };

      const severityCounts = {
        critical: comments.filter(c => c.message.toLowerCase().includes('critical')).length,
        high: comments.filter(c => c.severity === 'error' && !c.message.toLowerCase().includes('critical')).length,
        medium: comments.filter(c => c.severity === 'warning').length,
        low: comments.filter(c => c.severity === 'info').length,
      };

      const appConfig = this.config.getAppConfig();
      const severityScore = (severityCounts.critical * 10) + (severityCounts.high * 5) + 
                            (severityCounts.medium * 2) + (severityCounts.low * 1);

      let decision: 'APPROVE' | 'REQUEST_CHANGES' = (severityScore >= appConfig.severityThreshold) ? 'REQUEST_CHANGES' : 'APPROVE';

      // Override if critical or high issues found
      if ((severityCounts.critical > 0 || severityCounts.high > 0) && decision === 'APPROVE') {
        this.logger.warn(`Overriding APPROVE -> REQUEST_CHANGES due to critical/high issues`);
        decision = 'REQUEST_CHANGES';
      }

      // 5. Save/Update PR Entity
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 80, 'Saving to database...');
      let prEntity = await this.prRepository.findOne({ where: { number: pr.number, repository: pr.repository.nameWithOwner } });
      if (!prEntity) {
        prEntity = this.prRepository.create({
          number: pr.number,
          repository: pr.repository.nameWithOwner,
          title: pr.title,
          url: pr.url,
          status: 'open',
          author: 'unknown',
          branch: pr.headRefName || 'unknown',
          baseBranch: pr.baseRefName || 'unknown',
          isDraft: false,
          labels: [],
        });
        prEntity = await queryRunner.manager.save(prEntity);
      }

      // 6. Create Review Entity
      const review = this.reviewRepository.create({
        prNumber: pr.number,
        repository: pr.repository.nameWithOwner,
        status: 'completed',
        mode: appConfig.reviewMode || 'comment',
        executor: (await this.config.getRepositoryConfig(pr.repository.nameWithOwner)).executor,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        pullRequest: prEntity,
      });
      const savedReview = await queryRunner.manager.save(review);

      // 7. Create Metrics Entity
      const metrics = this.metricsRepository.create({
        reviewId: savedReview.id,
        duration: Date.now() - startTime,
        filesReviewed: 0,
        commentsGenerated: comments.length,
        issuesFound,
        healthScore: Math.max(0, 100 - severityScore),
        qualityScore: Math.max(0, 100 - severityScore),
        review: savedReview,
      });
      await queryRunner.manager.save(metrics);

      // 8. Create Comment Entities
      const commentEntities = comments.map(c => this.commentRepository.create({
        reviewId: savedReview.id,
        file: c.file_path,
        line: c.line_number,
        message: c.message,
        severity: c.severity,
        category: c.issue_type,
        suggestion: c.suggested_fix,
        review: savedReview,
      }));
      await queryRunner.manager.save(commentEntities);

      // 9. Post comments to GitHub
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 90, 'Posting to GitHub...');
      const summaryMessage = this.buildSummaryMessage(comments, decision, severityScore);
      await this.github.addReview(pr.repository.nameWithOwner, pr.number, summaryMessage, decision);

      // 10. Commit transaction
      await queryRunner.commitTransaction();

      // 11. Auto-merge if approved
      if (decision === 'APPROVE' && appConfig.autoMerge) {
        this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 95, 'Auto-merging PR...');
        await this.github.mergePR(pr.repository.nameWithOwner, pr.number);
      }

      this.logger.log(`Successfully completed review for PR #${pr.number}`);
      this.gateway.broadcastReviewCompleted(pr.number, pr.repository.nameWithOwner, { decision, severityScore });
      return true;
    } catch (error) {
      this.logger.error(`Failed to review PR #${pr.number}: ${error.message}`, error.stack);
      this.gateway.broadcastReviewFailed(pr.number, pr.repository.nameWithOwner, error.message);
      await queryRunner.rollbackTransaction();
      return false;
    } finally {
      await queryRunner.release();
    }
  }

  private buildSummaryMessage(comments: any[], decision: string, score: number): string {
    if (comments.length === 0) {
      return "LGTM! No issues found by AI review.";
    }

    let msg = `### AI Review Summary\n\n`;
    msg += `**Decision:** ${decision}\n`;
    msg += `**Severity Score:** ${score}\n\n`;
    msg += `Found ${comments.length} potential issues. Please check inline comments for details.`;
    
    return msg;
  }

  async runOnce(): Promise<void> {
    this.logger.log('Starting Review Engine (Once Mode)...');
    const prs = await this.github.fetchOpenPRs();
    this.logger.log(`Found ${prs.length} open PRs to review.`);

    for (const pr of prs) {
      await this.reviewPullRequest(pr);
    }
    this.logger.log('Review Engine (Once Mode) completed.');
  }
}
