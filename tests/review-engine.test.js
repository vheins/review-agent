import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reviewEngine } from '../src/review-engine.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ReviewEngine', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-review');
  const testDbPath = path.join(testDbDir, 'test-review.db');

  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;

    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO repositories (id, github_repo_id, owner, name, full_name, default_branch, created_at, updated_at)
      VALUES (1, 101, 'system', 'test', 'system/test', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
    
    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO developers (id, github_username, created_at, updated_at)
      VALUES (1, 'dev1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
      VALUES (1, 1101, 1, 1, 'PR 1', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('Should determine review level correctly', () => {
    expect(reviewEngine.determineReviewLevel('main')).toBe('strict');
    expect(reviewEngine.determineReviewLevel('feat/api')).toBe('standard');
    expect(reviewEngine.determineReviewLevel('docs/readme')).toBe('relaxed');
  });

  it('Should determine outcome based on comments', () => {
    const criticalComments = [{ severity: 'critical' }];
    expect(reviewEngine.determineOutcome(criticalComments)).toBe('rejected');

    const warningComments = [{ severity: 'warning' }, { severity: 'warning' }, { severity: 'warning' }];
    expect(reviewEngine.determineOutcome(warningComments)).toBe('needs_changes');

    const minorComments = [{ severity: 'info' }];
    expect(reviewEngine.determineOutcome(minorComments)).toBe('approved');
  });

  it('Should manage review history', async () => {
    // Create manual sessions
    testDbManager.db.prepare(`
      INSERT INTO review_sessions (id, pr_id, executor_type, status, started_at, outcome)
      VALUES (1, 1, 'gemini', 'completed', '2023-01-01T10:00:00Z', 'approved')
    `).run();

    const history = await reviewEngine.getReviewHistory(1);
    expect(history.length).toBe(1);
    expect(history[0].outcome).toBe('approved');
  });
});
