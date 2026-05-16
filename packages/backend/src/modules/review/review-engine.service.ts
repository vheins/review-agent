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
import { DocumentationReviewService } from './services/documentation-review.service.js';
import { AuditLoggerService } from '../../common/audit/audit-logger.service.js';
import { GamificationService } from '../team/services/gamification.service.js';
import { MetricsService } from '../metrics/metrics.service.js';

/**
 * ReviewEngineService - Core service for orchestrating PR reviews
 */
@Injectable()
export class ReviewEngineService {
  private readonly logger = new Logger(ReviewEngineService.name);
  private readonly blockingCheckConclusions = new Set([
    'action_required',
    'cancelled',
    'failure',
    'startup_failure',
    'stale',
    'timed_out',
  ]);

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
    private readonly documentationReview: DocumentationReviewService,
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

  private getStaleTakeoverPolicy(pr: PullRequest): {
    enabled: boolean;
    reason: string | null;
  } {
    const appConfig = this.config.getAppConfig();
    const staleDays = appConfig.staleInvolvesReviewDays || 3;
    const matchedScopes = new Set(pr.matchedScopes || []);
    const updatedAt = pr.updatedAt ? new Date(pr.updatedAt) : null;
    const staleThresholdMs = staleDays * 24 * 60 * 60 * 1000;

    if (pr.draft || pr.state !== 'open' || !matchedScopes.has('involves') || !updatedAt) {
      return { enabled: false, reason: null };
    }

    const ageMs = Date.now() - updatedAt.getTime();
    if (Number.isNaN(ageMs) || ageMs < staleThresholdMs) {
      return { enabled: false, reason: null };
    }

    return {
      enabled: true,
      reason: `PR stale lebih dari ${staleDays} hari dan masuk scope involves me.`,
    };
  }

  private getEffectiveRepoConfig<T extends { reviewMode?: string; autoMerge?: boolean; executor?: string }>(
    pr: PullRequest,
    repoConfig: T,
  ): T {
    const takeover = this.getStaleTakeoverPolicy(pr);
    if (!takeover.enabled) return repoConfig;

    return {
      ...repoConfig,
      reviewMode: 'auto-fix',
      autoMerge: true,
    };
  }

  private sortReviewCandidates(prs: PullRequest[]): PullRequest[] {
    return [...prs].sort((a, b) => {
      const aTakeover = this.getStaleTakeoverPolicy(a).enabled ? 1 : 0;
      const bTakeover = this.getStaleTakeoverPolicy(b).enabled ? 1 : 0;
      if (aTakeover !== bTakeover) return bTakeover - aTakeover;

      const aUpdatedAt = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bUpdatedAt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (aUpdatedAt !== bUpdatedAt) return aUpdatedAt - bUpdatedAt;

      return a.number - b.number;
    });
  }

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
      const effectiveRepoConfig = this.getEffectiveRepoConfig(pr, repoConfig);
      const takeover = this.getStaleTakeoverPolicy(pr);
      deepPR.takeoverMode = takeover.enabled ? 'direct-fix' : 'review-only';
      deepPR.takeoverReason = takeover.reason;
      pr.takeoverMode = deepPR.takeoverMode;
      pr.takeoverReason = deepPR.takeoverReason;

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

      // 1.5 Read mergeability
      const currentMergeableState = deepPR?.mergeable_state || pr.mergeable_state;
      if (!currentMergeableState || currentMergeableState === 'unknown') {
        const detail = await this.github.getPRDetail(pr.repository.nameWithOwner, pr.number);
        deepPR = { ...deepPR, ...detail };
      }

      // 1.6 Reject PR if merge conflicts exist (before sending to AI agent)
      const mergeState = (deepPR.mergeable_state || '').toLowerCase();
      if (mergeState === 'dirty' || deepPR.mergeable === false) {
        this.logger.log(`PR #${pr.number} has merge conflicts (mergeable_state: ${mergeState}) — rejecting with instructions.`);
        const creatorLogin = deepPR.author?.login || pr.author?.login || 'unknown';
        const reviewBody = `Konflik terdeteksi di PR ini. @${creatorLogin} tolong selesaikan konflik dengan base branch terlebih dahulu sebelum review dapat dilanjutkan.`;
        try {
          await this.github.addReview(pr.repository.nameWithOwner, pr.number, reviewBody, 'REQUEST_CHANGES');
          this.logger.log(`Successfully submitted conflict rejection for PR #${pr.number}`);
        } catch (reviewError) {
          this.logger.warn(`Failed to submit conflict rejection review for PR #${pr.number}: ${reviewError.message}`);
        }
        this.gateway.broadcastReviewCompleted(pr.number, pr.repository.nameWithOwner, { status: 'rejected', reason: 'merge_conflict' });
        await queryRunner.rollbackTransaction();
        return false;
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
      const documentationComments = await this.documentationReview.analyzeChangedFiles(changedFiles, repoDir);
      aiComments = [
        ...(Array.isArray(parsedComments) ? parsedComments : []),
        ...documentationComments,
      ];

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
        mode: effectiveRepoConfig.reviewMode,
        executor: effectiveRepoConfig.executor,
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
        { agentDecision, healthScore, qualityScore, mode: effectiveRepoConfig.reviewMode }
      );

      // 12. Agent output has already handled GitHub review/comment/merge actions.
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 90, 'Agent GitHub actions completed.');

      // Safety net: if the agent approved but left the PR open, merge it deterministically here.
      await this.ensureApprovedPrMerged(deepPR, effectiveRepoConfig, agentDecision);

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
   *   - PR has pending requested reviewers despite CHANGES_REQUESTED (race condition), OR
   *   - PR is approved but still needs the CLI agent to resolve/merge
   */
  private async shouldSkipPR(pr: any): Promise<boolean> {
    try {
      const takeover = this.getStaleTakeoverPolicy(pr);
      const incomingUpdatedAt = pr.updatedAt ? new Date(pr.updatedAt) : null;
      if (incomingUpdatedAt && !Number.isNaN(incomingUpdatedAt.getTime())) {
        const localPr = await this.prRepository.findOne({
          where: { number: pr.number, repository: pr.repository.nameWithOwner },
        });

        if (
          localPr?.head_sha &&
          (pr.headSha ? localPr.head_sha === pr.headSha : true) &&
          localPr.updatedAt.getTime() >= incomingUpdatedAt.getTime() &&
          localPr.mergeable_state !== 'dirty'
        ) {
          const latestCompletedReview = await this.reviewRepository.findOne({
            where: {
              prNumber: pr.number,
              repository: pr.repository.nameWithOwner,
              status: 'completed',
            },
            order: { completedAt: 'DESC' },
          });

          if (
            latestCompletedReview?.completedAt &&
            latestCompletedReview.completedAt.getTime() >= incomingUpdatedAt.getTime()
          ) {
            const repoConfig = await this.config.getRepositoryConfig(pr.repository.nameWithOwner);
            const effectiveRepoConfig = this.getEffectiveRepoConfig(pr, repoConfig);
            if (!effectiveRepoConfig.autoMerge && !takeover.enabled) {
              this.logger.log(`PR #${pr.number} unchanged since last completed local review — skipping GitHub status checks.`);
              return true;
            }
          }
        }
      }

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
          if (takeover.enabled) {
            this.logger.log(`PR #${pr.number} stale pada HEAD ${headSha.slice(0, 7)} — takeover aktif untuk direct fix.`);
            return false;
          }

          // Jangan skip jika ada pending review request (race condition: author re-request review tanpa push commit)
          try {
            const prDetail = await this.github.getPRDetail(pr.repository.nameWithOwner, pr.number);
            if (prDetail.requested_reviewers?.length > 0) {
              this.logger.log(`PR #${pr.number} has pending review requests (${prDetail.requested_reviewers.join(', ')}) — re-reviewing despite CHANGES_REQUESTED at HEAD.`);
              return false;
            }
          } catch (e) {
            this.logger.warn(`Could not check requested reviewers for PR #${pr.number}: ${e.message}`);
          }

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
            const effectiveRepoConfig = this.getEffectiveRepoConfig(pr, repoConfig);
            if (effectiveRepoConfig.autoMerge || takeover.enabled) {
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
    prs = this.sortReviewCandidates(prs);
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
    prs = this.sortReviewCandidates(prs);
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

  private async ensureApprovedPrMerged(
    pr: PullRequest,
    repoConfig: { autoMerge?: boolean },
    agentDecision: 'APPROVE' | 'REQUEST_CHANGES' | 'UNKNOWN',
  ): Promise<void> {
    if (!repoConfig.autoMerge) return;
    if (this.config.getAppConfig().dryRun) return;

    const repoName = pr.repository.nameWithOwner;
    const detail = await this.github.getPRDetail(repoName, pr.number);
    if (!detail) {
      this.logger.warn(`Could not load fresh PR detail for merge fallback on PR #${pr.number}.`);
      return;
    }
    if (detail.merged || detail.state !== 'open') return;

    const reviews = await this.github.listReviews(repoName, pr.number);
    const submittedReviews = reviews.filter((review: any) =>
      review?.state === 'APPROVED' || review?.state === 'CHANGES_REQUESTED',
    );
    const lastReview = submittedReviews[submittedReviews.length - 1];
    const headSha = detail.headSha || pr.headSha;
    const mergeableState = detail.mergeable_state || pr.mergeable_state || '';
    const approvedAtHead = Boolean(
      lastReview &&
      lastReview.state === 'APPROVED' &&
      lastReview.commit_id &&
      headSha &&
      lastReview.commit_id === headSha,
    );

    if (!approvedAtHead && agentDecision !== 'APPROVE') {
      return;
    }

    if (detail.mergeable === false || mergeableState === 'dirty' || mergeableState === 'blocked') {
      this.logger.log(
        `PR #${pr.number} remains open after review but is not mergeable (mergeable=${detail.mergeable}, state=${mergeableState || 'unknown'}).`,
      );
      return;
    }

    try {
      const comments = await this.github.listReviewComments(repoName, pr.number);
      const hasFixable = comments.some((comment: any) => this.autoFix.isFixable(comment));
      if (hasFixable) {
        this.logger.log(`PR #${pr.number} remains open after approval but still has fixable review comments.`);
        return;
      }
    } catch (error) {
      this.logger.warn(`Could not verify review comments before merge fallback for PR #${pr.number}: ${error.message}`);
      return;
    }

    try {
      const checks = await this.github.getPRChecks(repoName, pr.number);
      const hasBlockingChecks = checks.some((check: any) => {
        const status = String(check?.status || '').toLowerCase();
        const conclusion = String(check?.conclusion || '').toLowerCase();
        return status !== 'completed' || this.blockingCheckConclusions.has(conclusion);
      });
      if (hasBlockingChecks) {
        this.logger.log(`PR #${pr.number} remains open after approval because status checks are not green yet.`);
        return;
      }
    } catch (error) {
      this.logger.warn(`Could not verify status checks before merge fallback for PR #${pr.number}: ${error.message}`);
      return;
    }

    const merged = await this.github.mergePR(repoName, pr.number, 'merge');
    if (merged) {
      this.logger.log(`Merged PR #${pr.number} via backend safety net after agent approval.`);
      return;
    }

    this.logger.warn(`Backend safety net could not merge approved PR #${pr.number}.`);
  }
}
