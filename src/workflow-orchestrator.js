import { dbManager } from './database.js';
import { logger } from './logger.js';
import { githubClient } from './github.js';
import { testAndHealService } from './test-and-heal-service.js';
import { assignmentEngine } from './assignment-engine.js';
import { reviewEngine } from './review-engine.js';
import { autoFixService } from './auto-fix-service.js';
import { autoMergeService } from './auto-merge-service.js';
import { escalationService } from './escalation-service.js';
import { wsManager } from './websocket-server.js';

export class WorkflowOrchestrator {
  constructor(dependencies = {}) {
    this.dbManager = dependencies.dbManager ?? dbManager;
    this.logger = dependencies.logger ?? logger;
    this.githubClient = dependencies.githubClient ?? githubClient;
    this.testAndHealService = dependencies.testAndHealService ?? testAndHealService;
    this.assignmentEngine = dependencies.assignmentEngine ?? assignmentEngine;
    this.reviewEngine = dependencies.reviewEngine ?? reviewEngine;
    this.autoFixService = dependencies.autoFixService ?? autoFixService;
    this.autoMergeService = dependencies.autoMergeService ?? autoMergeService;
    this.escalationService = dependencies.escalationService ?? escalationService;
    this.wsManager = dependencies.wsManager ?? wsManager;
  }

  async processPullRequest(payload) {
    const pr = this.upsertPullRequest(payload);
    this.wsManager.broadcast('pr_update', {
      prId: pr.id,
      stage: 'queued',
      status: pr.status,
      githubPrId: pr.github_pr_id
    });

    const repoDir = await this.githubClient.prepareRepository({
      number: pr.github_pr_id,
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName,
      repository: { nameWithOwner: pr.repository }
    });

    const initialTestRun = await this.testAndHealService.runTests(repoDir, pr.id, 'initial');
    const effectiveTestStatus = initialTestRun?.healResult?.status ?? initialTestRun?.status ?? 'failed';

    this.wsManager.broadcast('pr_update', {
      prId: pr.id,
      stage: 'test_and_heal',
      status: effectiveTestStatus
    });

    if (effectiveTestStatus !== 'passed') {
      await this.escalationService.escalate(pr.id, 'pull_request', 'Tests failed before review', 'high');
      return { status: 'tests_failed', prId: pr.id };
    }

    const changedFiles = await this.reviewEngine.getChangedFiles(repoDir, pr);
    const assignedIds = await this.assignmentEngine.assignReviewers(
      pr.id,
      changedFiles.map((file) => file.path),
      pr.author_id
    );

    const reviewerUsernames = this.getReviewerUsernames(assignedIds);
    if (reviewerUsernames.length > 0) {
      await this.githubClient.assignReviewers(pr.repository, pr.github_pr_id, reviewerUsernames);
    }

    this.wsManager.broadcast('pr_update', {
      prId: pr.id,
      stage: 'assignment',
      reviewerIds: assignedIds
    });

    let reviewResult = await this.reviewEngine.reviewPR(pr, repoDir);
    let lifecycleStage = 'review_complete';

    if (reviewResult.outcome !== 'approved') {
      const autoFixResult = await this.autoFixService.fixPR(pr, reviewResult.reviewSessionId, repoDir);
      lifecycleStage = 'auto_fix';
      this.wsManager.broadcast('pr_update', {
        prId: pr.id,
        stage: lifecycleStage,
        status: autoFixResult.status
      });

      if (autoFixResult.status === 'success') {
        reviewResult = await this.reviewEngine.reReview(pr, repoDir);
        lifecycleStage = 're_review';
      } else if (reviewResult.outcome !== 'approved') {
        await this.escalationService.escalate(pr.id, 'pull_request', 'Auto-fix failed to resolve review findings', 'high');
      }
    }

    const mergeResult = await this.autoMergeService.mergeIfEligible(pr, {
      latestReviewOutcome: reviewResult.outcome,
      latestTestStatus: effectiveTestStatus,
      healthScore: pr.health_score ?? 100,
      repository: pr.repository
    });

    this.wsManager.broadcast('pr_update', {
      prId: pr.id,
      stage: mergeResult.merged ? 'merged' : lifecycleStage,
      outcome: reviewResult.outcome,
      merged: mergeResult.merged,
      mergeStatus: mergeResult.status
    });

    if (!mergeResult.merged && mergeResult.status !== 'blocked') {
      await this.escalationService.escalate(pr.id, 'pull_request', 'Merge failed after successful review', 'high');
    }

    return {
      status: mergeResult.merged ? 'merged' : reviewResult.outcome,
      prId: pr.id,
      reviewResult,
      mergeResult,
      assignedIds
    };
  }

  upsertPullRequest(payload) {
    if (!this.dbManager.isAvailable()) {
      throw new Error('Database not available');
    }

    const repository = payload.repository?.full_name ?? payload.repository?.nameWithOwner ?? payload.repository;
    const repositoryOwner = payload.repository?.owner?.login ?? repository.split('/')[0];
    const repositoryName = payload.repository?.name ?? repository.split('/')[1];
    const authorUsername = payload.pull_request?.user?.login ?? payload.author?.login ?? 'unknown';
    const authorDisplayName = payload.pull_request?.user?.login ?? authorUsername;
    const prPayload = payload.pull_request ?? payload;
    const githubPrId = prPayload.number ?? payload.number;

    const repositoryId = this.upsertRepository(repository, repositoryOwner, repositoryName, prPayload.base?.ref ?? prPayload.baseRefName ?? 'main');
    const authorId = this.upsertDeveloper(authorUsername, authorDisplayName);

    const existing = this.dbManager.db.prepare(`
      SELECT id
      FROM pull_requests
      WHERE github_pr_id = ? AND repository_id = ?
    `).get(githubPrId, repositoryId);

    const row = {
      repository_id: repositoryId,
      author_id: authorId,
      title: prPayload.title,
      description: prPayload.body ?? null,
      source_branch: prPayload.head?.ref ?? prPayload.headRefName ?? 'unknown',
      target_branch: prPayload.base?.ref ?? prPayload.baseRefName ?? 'main',
      status: prPayload.merged_at ? 'merged' : (prPayload.state ?? 'open'),
      created_at: prPayload.created_at ?? new Date().toISOString(),
      updated_at: prPayload.updated_at ?? new Date().toISOString(),
      merged_at: prPayload.merged_at ?? null
    };

    if (existing) {
      this.dbManager.db.prepare(`
        UPDATE pull_requests
        SET
          author_id = @author_id,
          title = @title,
          description = @description,
          source_branch = @source_branch,
          target_branch = @target_branch,
          status = @status,
          updated_at = @updated_at,
          merged_at = @merged_at
        WHERE id = @id
      `).run({
        ...row,
        id: existing.id
      });

      return {
        id: existing.id,
        github_pr_id: githubPrId,
        number: githubPrId,
        repository_id: repositoryId,
        author_id: authorId,
        repository,
        headRefName: row.source_branch,
        baseRefName: row.target_branch,
        health_score: 100,
        ...row
      };
    }

    const result = this.dbManager.db.prepare(`
      INSERT INTO pull_requests (
        github_pr_id,
        repository_id,
        author_id,
        title,
        description,
        source_branch,
        target_branch,
        status,
        created_at,
        updated_at,
        merged_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      githubPrId,
      repositoryId,
      authorId,
      row.title,
      row.description,
      row.source_branch,
      row.target_branch,
      row.status,
      row.created_at,
      row.updated_at,
      row.merged_at
    );

    return {
      id: result.lastInsertRowid,
      github_pr_id: githubPrId,
      number: githubPrId,
      repository_id: repositoryId,
      author_id: authorId,
      repository,
      headRefName: row.source_branch,
      baseRefName: row.target_branch,
      health_score: 100,
      ...row
    };
  }

  upsertRepository(fullName, owner, name, defaultBranch) {
    const existing = this.dbManager.db.prepare(`
      SELECT id
      FROM repositories
      WHERE full_name = ?
    `).get(fullName);

    if (existing) {
      return existing.id;
    }

    const githubRepoId = Math.floor(Math.random() * 1000000000);
    const result = this.dbManager.db.prepare(`
      INSERT INTO repositories (
        github_repo_id,
        owner,
        name,
        full_name,
        default_branch,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(githubRepoId, owner, name, fullName, defaultBranch);

    return result.lastInsertRowid;
  }

  upsertDeveloper(username, displayName) {
    const existing = this.dbManager.db.prepare(`
      SELECT id
      FROM developers
      WHERE github_username = ?
    `).get(username);

    if (existing) {
      return existing.id;
    }

    const result = this.dbManager.db.prepare(`
      INSERT INTO developers (github_username, display_name, created_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(username, displayName);

    return result.lastInsertRowid;
  }

  getReviewerUsernames(reviewerIds) {
    if (reviewerIds.length === 0) {
      return [];
    }

    const placeholders = reviewerIds.map(() => '?').join(',');
    return this.dbManager.db.prepare(`
      SELECT github_username
      FROM developers
      WHERE id IN (${placeholders})
      ORDER BY github_username ASC
    `).all(...reviewerIds).map((row) => row.github_username);
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();
export default workflowOrchestrator;
