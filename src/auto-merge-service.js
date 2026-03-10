import { dbManager } from './database.js';
import { configManager } from './config.js';
import { githubClient } from './github.js';
import { logger } from './logger.js';

export class AutoMergeService {
  constructor(dependencies = {}) {
    this.dbManager = dependencies.dbManager ?? dbManager;
    this.configManager = dependencies.configManager ?? configManager;
    this.githubClient = dependencies.githubClient ?? githubClient;
    this.logger = dependencies.logger ?? logger;
  }

  async getMergeConfiguration(repositoryId) {
    const repositoryConfig = await this.configManager.getRepoConfig(repositoryId);

    return {
      enabled: Boolean(repositoryConfig.autoMerge),
      healthThreshold: Number(repositoryConfig.autoMergeHealthThreshold ?? 60),
      requiredChecks: Array.isArray(repositoryConfig.requiredChecks)
        ? repositoryConfig.requiredChecks
        : String(repositoryConfig.requiredChecks ?? 'tests,review')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
    };
  }

  async evaluate(pr, context = {}) {
    if (!this.dbManager.isAvailable()) {
      return { eligible: false, reasons: ['database_unavailable'] };
    }

    const configuration = await this.getMergeConfiguration(pr.repository_id);
    if (!configuration.enabled) {
      return { eligible: false, reasons: ['auto_merge_disabled'], configuration };
    }

    const reasons = [];
    const latestReviewOutcome = context.latestReviewOutcome ?? this.getLatestReviewOutcome(pr.id);
    const latestTestStatus = context.latestTestStatus ?? this.getLatestTestStatus(pr.id);
    const unresolvedSecurityFindings = context.unresolvedSecurityFindings ?? this.getUnresolvedSecurityFindings(pr.id);
    const healthScore = Number(context.healthScore ?? pr.health_score ?? 0);

    if (healthScore < configuration.healthThreshold) {
      reasons.push('health_score_below_threshold');
    }

    if (configuration.requiredChecks.includes('review') && latestReviewOutcome !== 'approved') {
      reasons.push('review_not_approved');
    }

    if (configuration.requiredChecks.includes('tests') && latestTestStatus !== 'passed') {
      reasons.push('tests_not_passed');
    }

    if (configuration.requiredChecks.includes('security') && unresolvedSecurityFindings > 0) {
      reasons.push('security_findings_present');
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      configuration
    };
  }

  async mergeIfEligible(pr, context = {}) {
    const evaluation = await this.evaluate(pr, context);
    if (!evaluation.eligible) {
      return {
        status: 'blocked',
        merged: false,
        reasons: evaluation.reasons,
        configuration: evaluation.configuration
      };
    }

    const repositoryName = pr.repository ?? pr.repository_full_name ?? context.repository;
    const prNumber = pr.number ?? pr.github_pr_id;
    const merged = await this.githubClient.mergePR(repositoryName, prNumber);

    if (!merged) {
      return { status: 'merge_failed', merged: false, reasons: ['github_merge_failed'] };
    }

    if (this.dbManager.isAvailable()) {
      this.dbManager.db.prepare(`
        UPDATE pull_requests
        SET status = 'merged', merged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(pr.id);
    }

    this.logger.info(`Auto-merged PR #${prNumber} from ${repositoryName}`);

    return { status: 'merged', merged: true, reasons: [] };
  }

  getLatestReviewOutcome(prId) {
    const row = this.dbManager.db.prepare(`
      SELECT outcome
      FROM review_sessions
      WHERE pr_id = ?
      ORDER BY COALESCE(completed_at, started_at) DESC
      LIMIT 1
    `).get(prId);

    return row?.outcome ?? null;
  }

  getLatestTestStatus(prId) {
    const row = this.dbManager.db.prepare(`
      SELECT status
      FROM test_runs
      WHERE pr_id = ?
      ORDER BY COALESCE(completed_at, started_at) DESC
      LIMIT 1
    `).get(prId);

    return row?.status ?? null;
  }

  getUnresolvedSecurityFindings(prId) {
    const row = this.dbManager.db.prepare(`
      SELECT COUNT(*) AS count
      FROM security_findings
      WHERE pr_id = ? AND is_resolved = 0
    `).get(prId);

    return row?.count ?? 0;
  }
}

export const autoMergeService = new AutoMergeService();
export default autoMergeService;
