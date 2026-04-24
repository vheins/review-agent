import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GitHubClientService, PullRequest } from '../github/github.service.js';
import { RepositoryManagerService } from '../github/services/repository-manager.service.js';
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
    private readonly repoManager: RepositoryManagerService,
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
    const appConfig = this.config.getAppConfig();

    try {
      this.logger.log(`Starting review for PR #${pr.number}: ${pr.title}`);

      // 0. Check if already merged
      if (pr.merged) {
        this.logger.log(`PR #${pr.number} is already merged — skipping.`);
        await queryRunner.rollbackTransaction();
        return false;
      }
      
      // Retroactive Enrichment: if branch info or OIDs are missing (common from bulk CLI search), fetch deep details
      let deepPR: PullRequest = pr;
      if (!pr.headRefName || !pr.headSha || pr.headRefName === 'unknown') {
        this.logger.log(`[Sync] Fetching deep details for PR #${pr.number} to resolve branch/OID info...`);
        deepPR = await this.github.getPRDetail(pr.repository.nameWithOwner, pr.number);
        // Sync original PR object to avoid inconsistencies if passed elsewhere
        pr.headRefName = deepPR.headRefName || 'unknown';
        pr.baseRefName = deepPR.baseRefName || 'unknown';
        pr.headSha = deepPR.headSha;
        pr.baseSha = deepPR.baseSha;
        this.logger.log(`[Sync] Resolved branch info for PR #${pr.number}: head=${pr.headRefName}, base=${pr.baseRefName}`);
      }
      
      this.gateway.broadcastReviewStarted(pr.number, pr.repository.nameWithOwner);

      const repoConfig = await this.config.getRepositoryConfig(pr.repository.nameWithOwner);

      // 1. Prepare repository
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 10, 'Preparing repository...');
      const repoDir = await this.repoManager.prepareRepository(
        pr.repository.nameWithOwner,
        pr.headRefName || 'unknown',
        pr.baseRefName || 'unknown',
        pr.number,
      );

      // Ensure base branch is available locally as remote-tracking ref
      const baseBranch = deepPR.baseRefName || pr.baseRefName || 'main';
      try {
        await this.github.execaVerbose('git', [
          'fetch', 'origin',
          `${baseBranch}:refs/remotes/origin/${baseBranch}`
        ], { cwd: repoDir });
      } catch (e) {
        this.logger.warn(`Failed to fetch base branch '${baseBranch}': ${e.message}`);
      }
      const baseRef = `origin/${baseBranch}`;

      // Resolve base SHA if missing (common from CLI)
      if (!deepPR.baseSha) {
        try {
          const { stdout } = await this.github.execaVerbose('git', ['rev-parse', baseRef], { cwd: repoDir });
          deepPR.baseSha = stdout.trim();
        } catch (e) {
          this.logger.warn(`Failed to resolve base SHA via git: ${e.message}`);
        }
      }

      // 1.5 Read mergeability for agent context/telemetry only.
      // The CLI agent owns conflict handling, review submission, rejection, and merge.
      const currentMergeableState = deepPR?.mergeable_state || pr.mergeable_state;
      if (!currentMergeableState || currentMergeableState === 'unknown') {
        const detail = await this.github.getPRDetail(pr.repository.nameWithOwner, pr.number);
        deepPR = { ...deepPR, ...detail };
      }
      
      // 2. Get changed files
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 20, 'Analyzing changed files...');
      const changedFiles = await this.github.getChangedFiles(repoDir, deepPR);

      if (changedFiles.length === 0) {
        this.logger.warn(`No changes found for PR #${pr.number}, skipping review.`);
        this.gateway.broadcastReviewCompleted(pr.number, pr.repository.nameWithOwner, { status: 'skipped', reason: 'no changes' });
        await queryRunner.rollbackTransaction();
        return false;
      }

      let allSecurityFindings: any[] = [];
      let depFindings: any[] = [];
      let aiComments: any[] = [];
      let summaryMessage = '';
      let agentDecision: 'APPROVE' | 'REQUEST_CHANGES' | 'UNKNOWN' = 'UNKNOWN';
      let healthScore = 100;
      let qualityScore = 100;

      // 3. Run Security Scans
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 30, 'Running security scans...');
      const staticFindings = await this.securityScanner.scanFiles(pr.repository.nameWithOwner, pr.number, changedFiles);
      depFindings = await this.dependencyScanner.scanDependencies(repoDir, pr.repository.nameWithOwner, pr.number);
      allSecurityFindings = [...staticFindings, ...depFindings];

      // 4. AI Review. The selected CLI agent is responsible for GitHub comments,
      // review submission, rejection, and merge according to context/review-prompt.md.
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 50, 'Executing AI review agent...');
      const rawAiOutput = await this.ai.executeRaw(deepPR, changedFiles.map((file) => file.path), repoDir);
      const parsedComments = this.ai.parseOutput(rawAiOutput);
      aiComments = Array.isArray(parsedComments) ? parsedComments : [];

      const decisionMatch = rawAiOutput.match(/\*?\*?DECISION\*?\*?:\s*(APPROVE|REQUEST[_\s]CHANGES)/i);
      const messageMatch = rawAiOutput.match(/\*?\*?MESSAGE\*?\*?:\s*([\s\S]+)/i);
      const parsedDecision = decisionMatch ? decisionMatch[1].toUpperCase().replace(/[\s_]+/, '_') : null;
      summaryMessage = messageMatch ? messageMatch[1].trim() : '';
      
      // 5. Calculate metrics. The CLI agent owns the GitHub review decision.
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 70, 'Calculating scores...');
      
      const tempComments = aiComments.map(c => ({
        severity: c.severity,
        category: c.issue_type,
        suggestion: c.suggested_fix,
      } as any));

      healthScore = this.metricsService.calculateHealthScore(allSecurityFindings, tempComments);
      qualityScore = this.metricsService.calculateQualityScore(tempComments);

      agentDecision = parsedDecision === 'APPROVE' || parsedDecision === 'REQUEST_CHANGES'
        ? parsedDecision
        : 'UNKNOWN';

      // 6. Save/Update PR Entity
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 80, 'Saving to database...');
      let prEntity = await this.prRepository.findOne({ where: { number: pr.number, repository: pr.repository.nameWithOwner } });
      
      if (!prEntity) {
        prEntity = this.prRepository.create({
          id: deepPR.id,
          number: pr.number,
          repository: pr.repository.nameWithOwner,
          title: pr.title,
          url: pr.url,
          status: 'open',
          state: 'open',
          node_id: deepPR.node_id || deepPR.id,
          author: pr.author?.login || deepPR.author?.login || 'unknown',
          branch: deepPR.headRefName || 'unknown',
          head_sha: deepPR.headSha || '',
          baseBranch: deepPR.baseRefName || 'unknown',
          base_sha: deepPR.baseSha || '',
          isDraft: deepPR.draft || false,
          labels: deepPR.labels || [],
        });
        prEntity = await queryRunner.manager.save(prEntity);
      }

      // 7. Create Review Entity
      const review = this.reviewRepository.create({
        prId: prEntity.id,
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

      // 11. Audit Log. No GitHub write action is performed here; the CLI agent owns it.
      await this.auditLogger.logAction(
        'review_completed',
        'ai-agent',
        'pull_request',
        `${pr.repository.nameWithOwner}#${pr.number}`,
        { agentDecision, healthScore, qualityScore, mode: repoConfig.reviewMode }
      );

      // 12. Agent output has already handled GitHub review/comment/merge actions.
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 90, 'Agent GitHub actions completed.');

      if (appConfig.dryRun) {
        this.logger.log(`[DryRun] CLI agent ran in dry-run mode for PR #${pr.number}`);
        console.log(`[DryRun] Agent summary for PR #${pr.number}:`, summaryMessage || '(no summary emitted)');
        if (depFindings.length > 0) {
          console.log(`[DryRun] Dependency findings (${depFindings.length}):`, depFindings.map(f => f.title));
        }
      }

      // 13. Commit transaction
      await queryRunner.commitTransaction();

      // 14. Real-time updates
      this.gateway.broadcastMetricsUpdate(pr.number, pr.repository.nameWithOwner, { healthScore, qualityScore });

      // 15. Gamification
      if (agentDecision === 'APPROVE') {
        await this.gamification.awardPoints(prEntity.author, 10, 'PR Approved by AI');
      }

      this.logger.log(`Successfully completed review for PR #${pr.number}`);
      this.gateway.broadcastReviewCompleted(pr.number, pr.repository.nameWithOwner, { decision: agentDecision, healthScore });
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

  /**
   * Returns true if PR should be skipped (already reviewed at current HEAD).
   * Returns false if PR needs review:
   *   - No submitted review yet, OR
   *   - Has new commits since last review (re-review needed), OR
   *   - review-requested is set (team asked for re-review), OR
   *   - PR is approved but still needs the CLI agent to resolve/merge
   */
  private async shouldSkipPR(pr: any): Promise<boolean> {
    try {
      const reviews = await this.github.listReviews(pr.repository.nameWithOwner, pr.number);
      const submitted = reviews.filter((r: any) => r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED');
      
      // If never reviewed, don't skip
      if (submitted.length === 0) return false;

      const lastReview = submitted[submitted.length - 1];

      // Get current HEAD sha — use pr.headSha if available, else fetch from API
      let headSha = pr.head_sha || pr.headSha;
      let mergeableState = pr.mergeable_state;
      
      if (!headSha || !mergeableState) {
        const detail: any = await this.github.getPRDetail(pr.repository.nameWithOwner, pr.number);
        headSha = headSha || detail.headSha;
        mergeableState = mergeableState || detail.mergeable_state || detail.mergeStateStatus;
      }

      // Check if it's already reviewed at current HEAD
      const isProcessedAtHead = headSha && lastReview.commit_id === headSha;

      if (isProcessedAtHead) {
        if (lastReview.state === 'CHANGES_REQUESTED') {
          this.logger.log(`PR #${pr.number} is already rejected at HEAD ${headSha.slice(0, 7)} — skipping until author pushes changes.`);
          return true;
        }

        if (lastReview.state === 'APPROVED') {
          // Even if approved, we don't skip if there are conflicts
          if (mergeableState === 'dirty') {
            this.logger.log(`PR #${pr.number} is approved but has conflicts (state: ${mergeableState}) — needs auto-fix.`);
            return false;
          }

          // Check if there are fixable comments by fetching them
          try {
            const comments = await this.github.listReviewComments(pr.repository.nameWithOwner, pr.number);
            const hasFixable = comments.some((c: any) => this.autoFix.isFixable(c));
            if (hasFixable) {
              this.logger.log(`PR #${pr.number} is approved but has fixable comments — needs auto-fix.`);
              return false;
            }
          } catch (e) {
            this.logger.warn(`Could not check for fixable comments on PR #${pr.number}: ${e.message}`);
          }

          // If autoMerge is enabled, don't skip if the PR is still open.
          // The CLI agent, not this service, owns the merge action.
          try {
            const repoConfig = await this.config.getRepositoryConfig(pr.repository.nameWithOwner);
            if (repoConfig.autoMerge) {
              this.logger.log(`PR #${pr.number} is approved but still open — sending to CLI agent for merge handling.`);
              return false;
            }
          } catch (e) {
            this.logger.warn(`Could not check autoMerge config for PR #${pr.number}: ${e.message}`);
          }

          this.logger.log(`PR #${pr.number} is approved and autoMerge is disabled or not applicable — skipping.`);
          return true;
        }
      }

      this.logger.log(`PR #${pr.number} needs re-review: state=${lastReview?.state || 'NONE'}, match=${lastReview?.commit_id?.slice(0, 7)}===${headSha?.slice(0, 7)}`);
      return false;
    } catch (e) {
      this.logger.warn(`Could not check reviews for PR #${pr.number}: ${e.message}`);
      return false;
    }
  }

  async runAll(): Promise<void> {
    this.logger.log('Starting Review Engine (Continuous Mode)...');
    let prs = await this.github.fetchOpenPRs();
    prs = prs.filter(pr => !pr.draft && pr.state === 'open');
    prs.sort((a, b) => a.number - b.number);
    this.logger.log(`Found ${prs.length} open (non-draft) PRs.`);

    let reviewed = 0;
    for (const pr of prs) {
      if (await this.shouldSkipPR(pr)) continue;
      const success = await this.reviewPullRequest(pr);
      if (success) reviewed++;
    }

    this.logger.log(`Review Engine (Continuous Mode) completed. Reviewed ${reviewed} PR(s).`);
  }

  async runOnce(): Promise<void> {
    this.logger.log('Starting Review Engine (Once Mode)...');
    let prs = await this.github.fetchOpenPRs();
    prs = prs.filter(pr => !pr.draft && pr.state === 'open');
    prs.sort((a, b) => a.number - b.number);
    this.logger.log(`Found ${prs.length} open (non-draft) PRs to review.`);

    if (prs.length === 0) {
      this.logger.log('No PRs to process.');
      return;
    }

    this.logger.log('Limiting to 1 PR for single-run execution.');
    for (const pr of prs) {
      if (await this.shouldSkipPR(pr)) continue;
      const reviewed = await this.reviewPullRequest(pr);
      if (reviewed) break;
      this.logger.warn(`PR #${pr.number} was skipped, trying next...`);
    }
    this.logger.log('Review Engine (Once Mode) completed.');
  }
}
