import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GitHubClientService, PullRequest } from '../github/github.service.js';
import { AiExecutorService } from '../ai/ai-executor.service.js';
import { AiFixGeneratorService } from '../ai/ai-fix-generator.service.js';
import { ReviewGateway } from '../websocket/review.gateway.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { Review } from '../../database/entities/review.entity.js';
import { PullRequest as PullRequestEntity } from '../../database/entities/pull-request.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { SecurityScannerService } from '../security/security-scanner.service.js';
import { DependencyScannerService } from '../security/dependency-scanner.service.js';
import { ChecklistService } from './checklist.service.js';
import { AutoFixService } from './services/auto-fix.service.js';
import { AuditLoggerService } from '../../common/audit/audit-logger.service.js';
import { GamificationService } from '../team/services/gamification.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import fs from 'fs-extra';
import * as path from 'path';

/**
 * ReviewEngineService - Core service for orchestrating PR reviews
 */
@Injectable()
export class ReviewEngineService {
  private readonly logger = new Logger(ReviewEngineService.name);

  constructor(
    private readonly github: GitHubClientService,
    private readonly ai: AiExecutorService,
    private readonly aiFixGen: AiFixGeneratorService,
    private readonly autoFix: AutoFixService,
    private readonly gateway: ReviewGateway,
    private readonly config: AppConfigService,
    private readonly dataSource: DataSource,
    private readonly securityScanner: SecurityScannerService,
    private readonly dependencyScanner: DependencyScannerService,
    private readonly checklistService: ChecklistService,
    private readonly auditLogger: AuditLoggerService,
    private readonly gamification: GamificationService,
    private readonly metricsService: MetricsService,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(PullRequestEntity)
    private readonly prRepository: Repository<PullRequestEntity>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(ReviewMetrics)
    private readonly metricsRepository: Repository<ReviewMetrics>,
  ) {}

  async reviewPullRequest(pr: PullRequest): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const startTime = Date.now();

    try {
      this.logger.log(`Starting review for PR #${pr.number}: ${pr.title}`);
      this.gateway.broadcastReviewStarted(pr.number, pr.repository.nameWithOwner);

      const reviewConfig = this.config.getReviewConfig();
      const repoConfig = await this.config.getRepositoryConfig(pr.repository.nameWithOwner);

      // 1. Prepare repository
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 10, 'Preparing repository...');
      const repoDir = await this.github.prepareRepository(pr);
      
      // 2. Get changed files and diff
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 20, 'Analyzing changed files...');
      const changedFiles = await this.github.getChangedFiles(repoDir, pr);
      const { stdout: diff } = await this.github.execaVerbose('git', ['diff', `${pr.baseRefName}...${pr.headRefName}`], { cwd: repoDir });
      
      if (!diff && changedFiles.length === 0) {
        this.logger.warn(`No changes found for PR #${pr.number}, skipping review.`);
        this.gateway.broadcastReviewCompleted(pr.number, pr.repository.nameWithOwner, { status: 'skipped', reason: 'no changes' });
        await queryRunner.rollbackTransaction();
        return true;
      }

      // 3. Run Security Scans
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 30, 'Running security scans...');
      const staticFindings = await this.securityScanner.scanFiles(pr.repository.nameWithOwner, pr.number, changedFiles);
      const depFindings = await this.dependencyScanner.scanDependencies(repoDir, pr.repository.nameWithOwner, pr.number);
      const allSecurityFindings = [...staticFindings, ...depFindings];

      // 4. AI Review
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 50, 'Executing AI review...');
      const aiComments = await this.ai.executeReview(pr, diff || '', repoDir);
      
      // 5. Calculate metrics and decision
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 70, 'Calculating scores...');
      
      const tempComments = aiComments.map(c => ({
        severity: c.severity,
        category: c.issue_type,
        suggestion: c.suggested_fix,
      } as any));

      const healthScore = this.metricsService.calculateHealthScore(allSecurityFindings, tempComments);
      const qualityScore = this.metricsService.calculateQualityScore(tempComments);

      let decision: 'APPROVE' | 'REQUEST_CHANGES' = (healthScore < (100 - reviewConfig.severityThreshold)) ? 'REQUEST_CHANGES' : 'APPROVE';

      if ((allSecurityFindings.length > 0 || aiComments.some(c => c.severity === 'error')) && decision === 'APPROVE') {
        decision = 'REQUEST_CHANGES';
      }

      // 6. Save/Update PR Entity
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 80, 'Saving to database...');
      let prEntity = await this.prRepository.findOne({ where: { number: pr.number, repository: pr.repository.nameWithOwner } });
      if (!prEntity) {
        prEntity = this.prRepository.create({
          number: pr.number,
          repository: pr.repository.nameWithOwner,
          title: pr.title,
          url: pr.url,
          status: 'open',
          author: pr.author?.login || 'unknown',
          branch: pr.headRefName || 'unknown',
          baseBranch: pr.baseRefName || 'unknown',
          isDraft: false,
          labels: [],
        });
        prEntity = await queryRunner.manager.save(prEntity);
      }

      // 7. Create Review Entity
      const review = this.reviewRepository.create({
        prNumber: pr.number,
        repository: pr.repository.nameWithOwner,
        status: 'completed',
        mode: repoConfig.reviewMode,
        executor: repoConfig.executor,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        pullRequest: prEntity,
      });
      const savedReview = await queryRunner.manager.save(review);

      // 8. Create Metrics Entity
      const metrics = this.metricsRepository.create({
        reviewId: savedReview.id,
        duration: Date.now() - startTime,
        filesReviewed: changedFiles.length,
        commentsGenerated: aiComments.length,
        issuesFound: {
          bugs: aiComments.filter(c => c.issue_type === 'logic').length,
          security: allSecurityFindings.length + aiComments.filter(c => c.issue_type === 'security').length,
          performance: 0,
          maintainability: aiComments.filter(c => c.issue_type === 'quality').length,
          architecture: 0,
          testing: 0,
        },
        healthScore,
        qualityScore,
        review: savedReview,
      });
      await queryRunner.manager.save(metrics);

      // 9. Create Comment Entities
      const commentEntities = aiComments.map(c => this.commentRepository.create({
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

      // 10. Attach Checklists
      await this.checklistService.attachChecklistsToReview(savedReview.id, pr.repository.nameWithOwner);

      // 11. Apply Auto-Fixes if enabled
      let fixesApplied = false;
      if (repoConfig.reviewMode === 'auto-fix') {
        const fixableComments = aiComments.filter(c => this.autoFix.isFixable(c));
        if (fixableComments.length > 0) {
          this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 85, 'Applying and verifying auto-fixes...');
          
          await this.autoFix.applyFixes(repoDir, fixableComments);
          await this.autoFix.runProjectFixers(repoDir);
          
          const verified = await this.autoFix.verifyFixes(repoDir);
          if (verified) {
            fixesApplied = await this.autoFix.commitAndPushFixes(repoDir, pr.headRefName);
          } else {
            this.logger.warn(`Auto-fixes failed verification for PR #${pr.number}, rolling back changes.`);
            await this.github.execaVerbose('git', ['reset', '--hard', 'HEAD'], { cwd: repoDir });
          }
        }
      }

      // 12. Audit Log
      await this.auditLogger.logAction(
        'review_completed',
        'ai-agent',
        'pull_request',
        `${pr.repository.nameWithOwner}#${pr.number}`,
        { decision, healthScore, qualityScore, mode: repoConfig.reviewMode, fixesApplied }
      );

      // 13. Post comments to GitHub
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 90, 'Posting to GitHub...');
      const summaryMessage = this.buildSummaryMessage(aiComments, allSecurityFindings, decision, healthScore, repoConfig.reviewMode, fixesApplied);
      await this.github.addReview(pr.repository.nameWithOwner, pr.number, summaryMessage, decision);

      // 14. Commit transaction
      await queryRunner.commitTransaction();

      // 15. Real-time updates
      this.gateway.broadcastMetricsUpdate(pr.number, pr.repository.nameWithOwner, { healthScore, qualityScore });

      // 16. Gamification
      if (decision === 'APPROVE') {
        await this.gamification.awardPoints(prEntity.author, 10, 'PR Approved by AI');
      }

      // 17. Auto-merge
      if (decision === 'APPROVE' && repoConfig.autoMerge && (repoConfig.reviewMode === 'comment' || fixesApplied)) {
        this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 95, 'Auto-merging PR...');
        await this.github.mergePR(pr.repository.nameWithOwner, pr.number);
      }

      this.logger.log(`Successfully completed review for PR #${pr.number}`);
      this.gateway.broadcastReviewCompleted(pr.number, pr.repository.nameWithOwner, { decision, healthScore });
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

  private buildSummaryMessage(aiComments: any[], securityFindings: any[], decision: string, healthScore: number, mode: string, fixesApplied: boolean): string {
    let msg = `### AI Review Summary (${mode} mode)\n\n`;
    msg += `**Decision:** ${decision}\n`;
    msg += `**Health Score:** ${healthScore}/100\n\n`;
    
    if (securityFindings.length > 0) {
      msg += `⚠️ **Found ${securityFindings.length} security vulnerabilities!**\n`;
    }
    
    if (mode === 'auto-fix' && fixesApplied) {
      msg += `✅ **Auto-fixes have been applied, verified, and pushed to your branch.**\n\n`;
    } else if (mode === 'auto-fix' && !fixesApplied && aiComments.some(c => this.autoFix.isFixable(c))) {
      msg += `❌ **Auto-fixes were attempted but failed verification tests. Manual intervention required.**\n\n`;
    }
    
    if (aiComments.length > 0) {
      msg += `Found ${aiComments.length} potential issues. Please check inline comments for details.`;
    } else if (securityFindings.length === 0) {
      msg += `LGTM! No significant issues found.`;
    }
    
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
