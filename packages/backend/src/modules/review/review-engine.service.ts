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

      const reviewConfig = this.config.getReviewConfig();
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
      
      // 2. Get changed files
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 20, 'Analyzing changed files...');
      const changedFiles = await this.github.getChangedFiles(repoDir, deepPR);

      if (changedFiles.length === 0) {
        this.logger.warn(`No changes found for PR #${pr.number}, skipping review.`);
        this.gateway.broadcastReviewCompleted(pr.number, pr.repository.nameWithOwner, { status: 'skipped', reason: 'no changes' });
        await queryRunner.rollbackTransaction();
        return false;
      }

      // 3. Run Security Scans
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 30, 'Running security scans...');
      const staticFindings = await this.securityScanner.scanFiles(pr.repository.nameWithOwner, pr.number, changedFiles);
      const depFindings = await this.dependencyScanner.scanDependencies(repoDir, pr.repository.nameWithOwner, pr.number);
      const allSecurityFindings = [...staticFindings, ...depFindings];

      // 4. AI Review
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 50, 'Executing AI review...');
      const rawAiOutput = await this.ai.executeRaw(pr, changedFiles.map((file) => file.path), repoDir);
      const aiComments = this.ai.parseOutput(rawAiOutput);

      // Parse structured output from AI (DECISION, SEVERITY_SCORE, MESSAGE)
      const severityScoreMatch = rawAiOutput.match(/\*?\*?SEVERITY[_\s]SCORE\*?\*?:\s*(\d+)/i);
      const severityBreakdownMatch = rawAiOutput.match(/\*?\*?SEVERITY[_\s]BREAKDOWN\*?\*?:\s*([^\n]+)/i);
      const decisionMatch = rawAiOutput.match(/\*?\*?DECISION\*?\*?:\s*(APPROVE|REQUEST[_\s]CHANGES)/i);
      const messageMatch = rawAiOutput.match(/\*?\*?MESSAGE\*?\*?:\s*([\s\S]+)/i);

      const severityBreakdown = severityBreakdownMatch ? severityBreakdownMatch[1].trim() : 'N/A';
      let severityScore = severityScoreMatch ? parseInt(severityScoreMatch[1], 10) : 0;
      let parsedDecision = decisionMatch ? decisionMatch[1].toUpperCase().replace(/[\s_]+/, '_') : null;
      let summaryMessage = messageMatch ? messageMatch[1].trim() : '';

      // Override APPROVE → REQUEST_CHANGES if critical/high found in breakdown
      if (parsedDecision === 'APPROVE' && severityBreakdownMatch) {
        const criticalCount = parseInt(severityBreakdown.match(/Critical:\s*(\d+)/i)?.[1] || '0', 10);
        const highCount = parseInt(severityBreakdown.match(/High:\s*(\d+)/i)?.[1] || '0', 10);
        if (criticalCount > 0 || highCount > 0) {
          this.logger.warn(`Overriding APPROVE → REQUEST_CHANGES due to Critical/High findings`);
          parsedDecision = 'REQUEST_CHANGES';
        }
      }
      
      // 5. Calculate metrics and decision
      this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 70, 'Calculating scores...');
      
      const tempComments = aiComments.map(c => ({
        severity: c.severity,
        category: c.issue_type,
        suggestion: c.suggested_fix,
      } as any));

      const healthScore = this.metricsService.calculateHealthScore(allSecurityFindings, tempComments);
      const qualityScore = this.metricsService.calculateQualityScore(tempComments);

      // Use parsed decision from AI output, fallback to score-based
      let decision: 'APPROVE' | 'REQUEST_CHANGES' = parsedDecision as any
        || ((healthScore < (100 - reviewConfig.severityThreshold)) ? 'REQUEST_CHANGES' : 'APPROVE');

      if ((allSecurityFindings.length > 0 || aiComments.some(c => c.severity === 'error')) && decision === 'APPROVE') {
        decision = 'REQUEST_CHANGES';
      }

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

      // 11. Apply Auto-Fixes if enabled
      let fixesApplied = false;
      if (repoConfig.reviewMode === 'auto-fix') {
        const fixableComments = aiComments.filter(c => this.autoFix.isFixable(c));
        if (fixableComments.length > 0) {
          this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 85, 'Applying and verifying auto-fixes...');
          
          if (appConfig.dryRun) {
            this.logger.log(`[DryRun] Skipping auto-fixes application for PR #${pr.number}`);
            fixesApplied = true; // Simulate success for dry run logic
          } else {
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
      const finalMessage = summaryMessage || this.buildSummaryMessage(aiComments, allSecurityFindings, decision, healthScore, repoConfig.reviewMode, fixesApplied);
      
      if (appConfig.dryRun) {
        this.logger.log(`[DryRun] Skipping GitHub review for PR #${pr.number}`);
        console.log(`[DryRun] Summary for PR #${pr.number}:`, finalMessage);
        if (depFindings.length > 0) {
          console.log(`[DryRun] Dependency findings (${depFindings.length}):`, depFindings.map(f => f.title));
        }
      } else {
        // Check if AI already posted a review (pending or submitted)
        let alreadyReviewed = false;
        try {
          const reviews = await this.github.listReviews(pr.repository.nameWithOwner, pr.number);
          const pendingReview = reviews.find((r: any) => r.state === 'PENDING');
          const submittedReviews = reviews.filter((r: any) => r.state !== 'PENDING');

          if (pendingReview) {
            // Post dependency findings as inline comments on the pending review
            if (depFindings.length > 0) {
              await this.postDepFindingsAsComments(pr.repository.nameWithOwner, pr.number, depFindings);
            }
            this.logger.log(`Found pending review id=${pendingReview.id} — submitting as ${decision}`);
            await this.github.submitPendingReview(pr.repository.nameWithOwner, pr.number, pendingReview.id, decision, finalMessage);
            alreadyReviewed = true;
          } else if (submittedReviews.length > 0) {
            this.logger.log(`AI already submitted ${submittedReviews.length} review(s) — skipping fallback`);
            alreadyReviewed = true;
          }
        } catch (e) {
          this.logger.warn(`Could not check existing reviews: ${e.message}`);
        }

        if (!alreadyReviewed) {
          // Create pending review, post dep findings, then submit
          if (depFindings.length > 0) {
            try {
              await this.github.createPendingReview(pr.repository.nameWithOwner, pr.number);
              await this.postDepFindingsAsComments(pr.repository.nameWithOwner, pr.number, depFindings);
              const reviews = await this.github.listReviews(pr.repository.nameWithOwner, pr.number);
              const pendingReview = reviews.find((r: any) => r.state === 'PENDING');
              if (pendingReview) {
                await this.github.submitPendingReview(pr.repository.nameWithOwner, pr.number, pendingReview.id, decision, finalMessage);
                alreadyReviewed = true;
              }
            } catch (e) {
              this.logger.warn(`Failed to post dep findings as inline comments: ${e.message}`);
            }
          }

          if (!alreadyReviewed) {
            this.logger.log(`No pending review found — posting fallback summary review`);
            await this.github.addReview(pr.repository.nameWithOwner, pr.number, finalMessage, decision);
          }
        }

        // Open PR in browser
        try {
          await this.github.execaVerbose('gh', ['pr', 'view', String(pr.number), '--repo', pr.repository.nameWithOwner, '--web'], { allowFail: true });
        } catch (_) {}
      }

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
        if (appConfig.dryRun) {
          this.logger.log(`[DryRun] Skipping auto-merge for PR #${pr.number}`);
        } else {
          this.gateway.broadcastReviewProgress(pr.number, pr.repository.nameWithOwner, 95, 'Auto-merging PR...');
          await this.github.mergePR(pr.repository.nameWithOwner, pr.number);
        }
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

  private async postDepFindingsAsComments(repoName: string, prNumber: number, findings: any[]): Promise<void> {
    for (const f of findings) {
      const severity = f.severity?.toUpperCase() || 'MEDIUM';
      const body = `[${severity}] **${f.title}**\n\n${f.description}`;
      try {
        await this.github.addFileComment(repoName, prNumber, f.filePath, body);
      } catch (e) {
        this.logger.warn(`Failed to post dep finding comment for ${f.filePath}: ${e.message}`);
      }
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

  /**
   * Returns true if PR should be skipped (already reviewed at current HEAD).
   * Returns false if PR needs review:
   *   - No submitted review yet, OR
   *   - Has new commits since last review (re-review needed), OR
   *   - review-requested is set (team asked for re-review)
   */
  private async shouldSkipPR(pr: any): Promise<boolean> {
    try {
      const reviews = await this.github.listReviews(pr.repository.nameWithOwner, pr.number);
      const submitted = reviews.filter((r: any) => r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED');
      if (submitted.length === 0) return false;

      const lastReview = submitted[submitted.length - 1];

      // Get current HEAD sha — use pr.headSha if available, else fetch from API
      let headSha = pr.headSha;
      if (!headSha) {
        const detail: any = await this.github.getPRDetail(pr.repository.nameWithOwner, pr.number);
        headSha = detail.headRefOid || detail.head?.sha;
      }

      if (headSha && lastReview.commit_id === headSha) {
        this.logger.log(`PR #${pr.number} already reviewed at HEAD ${headSha.slice(0, 7)} — skipping.`);
        return true;
      }

      this.logger.log(`PR #${pr.number} has new commits since last review (${lastReview.commit_id?.slice(0, 7)} → ${headSha?.slice(0, 7)}) — re-reviewing.`);
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
