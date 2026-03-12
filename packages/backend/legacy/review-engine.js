import { dbManager } from './database.js';
import { aiExecutorRegistry } from './ai-executors.js';
import { ruleEngine } from './rule-engine.js';
import { qualityScorer } from './quality-scorer.js';
import { metricsEngine } from './metrics-engine.js';
import { logger } from './logger.js';
import { githubClient } from './github.js';
import { wsManager } from './websocket-server.js';
import path from 'path';
import fs from 'fs-extra';

export class ReviewEngine {
  constructor() {}

  async reviewPR(pr, repoDir) {
    if (!dbManager.isAvailable()) throw new Error('Database not available');

    const startTime = new Date().toISOString();
    
    // Determine review level based on branch name
    const reviewLevel = this.determineReviewLevel(pr.headRefName);
    logger.info(`Review level for branch ${pr.headRefName}: ${reviewLevel}`);

    // 1. Initialize Review Session
    const reviewSessionId = dbManager.db.prepare(`
      INSERT INTO review_sessions (pr_id, executor_type, status, started_at)
      VALUES (?, ?, 'processing', ?)
    `).run(pr.id, 'gemini', startTime).lastInsertRowid;

    wsManager.broadcast('review_started', { prId: pr.id, reviewSessionId });

    // Update PR with review level
    dbManager.db.prepare('UPDATE pull_requests SET review_level = ? WHERE id = ?').run(reviewLevel, pr.id);

    try {
      // 2. Fetch Diff
      logger.info(`Fetching diff for PR #${pr.number}...`);
      wsManager.broadcast('review_progress', { reviewSessionId, step: 'fetching_diff' });
      const { stdout: diff } = await githubClient.execaVerbose('git', ['diff', `origin/${pr.baseRefName}...${pr.headRefName}`], { cwd: repoDir });

      // 3. Rule Validation
      logger.info('Running custom rules...');
      wsManager.broadcast('review_progress', { reviewSessionId, step: 'running_rules' });
      const changedFiles = await this.getChangedFiles(repoDir, pr);
      const ruleViolations = await ruleEngine.executeRules(pr.repository_id, pr.headRefName, changedFiles);

      // 4. AI Review
      logger.info('Running AI review...');
      wsManager.broadcast('review_progress', { reviewSessionId, step: 'ai_review' });
      const executor = await aiExecutorRegistry.selectBestExecutor(pr);
      const aiOutput = await executor.review(pr, diff, repoDir);
      const aiComments = executor.parseOutput(aiOutput);

      // ... rest of method ...
      // Consolidate Comments
      const allComments = [...ruleViolations, ...aiComments];
      
      // Store Comments
      dbManager.transaction(() => {
        const insertStmt = dbManager.db.prepare(`
          INSERT INTO review_comments (
            review_session_id, file_path, line_number, issue_type, 
            severity, message, code_snippet, suggested_fix, is_auto_fixable, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        for (const c of allComments) {
          insertStmt.run(
            reviewSessionId, c.file_path, c.line_number, c.issue_type,
            c.severity, c.message, c.code_snippet || null, 
            c.suggested_fix || null, c.is_auto_fixable ? 1 : 0
          );
        }
      })();

      // 7. Quality Scoring
      logger.info('Calculating quality score...');
      wsManager.broadcast('review_progress', { reviewSessionId, step: 'scoring' });
      const scoreDetails = await qualityScorer.scoreReview(reviewSessionId);

      // 8. Determine Outcome
      const outcome = this.determineOutcome(allComments);
      const endTime = new Date().toISOString();

      dbManager.db.prepare(`
        UPDATE review_sessions 
        SET status = 'completed', completed_at = ?, outcome = ?, 
            duration_seconds = ?
        WHERE id = ?
      `).run(
        endTime, 
        outcome, 
        Math.floor((new Date(endTime) - new Date(startTime)) / 1000),
        reviewSessionId
      );

      // 9. Record Metrics
      await metricsEngine.recordReview(pr.id, executor.name, startTime, endTime, outcome);

      wsManager.broadcast('review_completed', { reviewSessionId, outcome });

      return { reviewSessionId, outcome, scoreDetails, commentCount: allComments.length };

    } catch (e) {
      logger.error(`Review failed for PR #${pr.number}: ${e.message}`);
      dbManager.db.prepare("UPDATE review_sessions SET status = 'failed' WHERE id = ?").run(reviewSessionId);
      wsManager.broadcast('review_failed', { reviewSessionId, error: e.message });
      throw e;
    }
  }

  determineReviewLevel(branchName) {
    if (/^(master|main|production|release\/.*)$/.test(branchName)) return 'strict';
    if (/^(feat\/.*|feature\/.*|bugfix\/.*)$/.test(branchName)) return 'standard';
    return 'relaxed';
  }

  determineOutcome(comments) {
    const criticals = comments.filter(c => c.severity === 'critical' || c.severity === 'error').length;
    if (criticals > 0) return 'rejected';
    
    const warnings = comments.filter(c => c.severity === 'high' || c.severity === 'warning').length;
    if (warnings > 2) return 'needs_changes';
    
    return 'approved';
  }

  async getChangedFiles(repoDir, pr) {
    const { stdout } = await githubClient.execaVerbose('git', ['diff', '--name-only', `origin/${pr.baseRefName}...${pr.headRefName}`], { cwd: repoDir });
    const filePaths = stdout.split('\n').filter(f => f.trim());
    
    const files = [];
    for (const filePath of filePaths) {
      const fullPath = path.join(repoDir, filePath);
      if (await fs.pathExists(fullPath)) {
        const content = await fs.readFile(fullPath, 'utf8');
        files.push({ path: filePath, content });
      }
    }
    return files;
  }

  async getReviewStatus(reviewSessionId) {
    if (!dbManager.isAvailable()) return null;
    return dbManager.db.prepare('SELECT * FROM review_sessions WHERE id = ?').get(reviewSessionId);
  }

  async getReviewHistory(prId) {
    if (!dbManager.isAvailable()) return [];

    const sessions = dbManager.db.prepare(`
      SELECT * FROM review_sessions WHERE pr_id = ? ORDER BY started_at ASC
    `).all(prId);

    for (const session of sessions) {
      session.comments = dbManager.db.prepare(`
        SELECT * FROM review_comments WHERE review_session_id = ?
      `).all(session.id);
    }

    return sessions;
  }

  async reReview(pr, repoDir) {
    logger.info(`Re-reviewing PR #${pr.number}...`);
    
    // Check for previous sessions
    const history = await this.getReviewHistory(pr.id);
    const iterationCount = history.length + 1;
    
    logger.info(`Starting iteration #${iterationCount}`);
    
    const result = await this.reviewPR(pr, repoDir);
    
    // Comparison logic could go here
    if (history.length > 0) {
      const prevOutcome = history[history.length - 1].outcome;
      logger.info(`Outcome changed from ${prevOutcome} to ${result.outcome}`);
    }

    return { ...result, iterationCount };
  }

  async cancelReview(reviewSessionId) {
    if (!dbManager.isAvailable()) return;

    dbManager.db.prepare(`
      UPDATE review_sessions SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND status = 'processing'
    `).run(reviewSessionId);
    
    logger.info(`Cancelled review session #${reviewSessionId}`);
  }
}

export const reviewEngine = new ReviewEngine();
export default reviewEngine;
