import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseManager, dbManager } from '../src/database.js';
import { AutoMergeService } from '../src/auto-merge-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AutoMergeService', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-auto-merge');
  const testDbPath = path.join(testDbDir, 'test-auto-merge.db');

  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;

    testDbManager.db.prepare(`
      UPDATE repositories
      SET github_repo_id = 1001, owner = 'acme', name = 'platform', full_name = 'acme/platform', default_branch = 'main'
      WHERE id = 1
    `).run();

    testDbManager.db.prepare(`
      INSERT INTO pull_requests (
        id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, health_score, created_at, updated_at
      ) VALUES (
        1, 42, 1, 1, 'Auto merge candidate', 'open', 'feature/auto-merge', 'main', 85, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run();

    testDbManager.db.prepare(`
      INSERT INTO review_sessions (
        pr_id, executor_type, status, started_at, completed_at, duration_seconds, outcome
      ) VALUES (
        1, 'gemini', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 120, 'approved'
      )
    `).run();

    testDbManager.db.prepare(`
      INSERT INTO test_runs (
        pr_id, run_type, status, test_results, started_at, completed_at, duration_seconds
      ) VALUES (
        1, 'initial', 'passed', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 30
      )
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    vi.restoreAllMocks();
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('merges when all criteria are satisfied', async () => {
    const service = new AutoMergeService({
      dbManager,
      configManager: {
        getRepoConfig: vi.fn().mockResolvedValue({
          autoMerge: true,
          autoMergeHealthThreshold: 60,
          requiredChecks: ['tests', 'review']
        })
      },
      githubClient: {
        mergePR: vi.fn().mockResolvedValue(true)
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    const result = await service.mergeIfEligible({
      id: 1,
      github_pr_id: 42,
      number: 42,
      repository_id: 1,
      repository: 'acme/platform',
      health_score: 85
    });

    expect(result).toEqual(expect.objectContaining({ status: 'merged', merged: true }));

    const pr = testDbManager.db.prepare('SELECT status, merged_at FROM pull_requests WHERE id = 1').get();
    expect(pr.status).toBe('merged');
    expect(pr.merged_at).not.toBeNull();
  });

  it('blocks merge when thresholds or checks are not satisfied', async () => {
    testDbManager.db.prepare('UPDATE pull_requests SET health_score = 45 WHERE id = 1').run();
    testDbManager.db.prepare("UPDATE test_runs SET status = 'failed' WHERE pr_id = 1").run();

    const service = new AutoMergeService({
      dbManager,
      configManager: {
        getRepoConfig: vi.fn().mockResolvedValue({
          autoMerge: true,
          autoMergeHealthThreshold: 60,
          requiredChecks: ['tests', 'review']
        })
      },
      githubClient: {
        mergePR: vi.fn()
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    const result = await service.mergeIfEligible({
      id: 1,
      github_pr_id: 42,
      number: 42,
      repository_id: 1,
      repository: 'acme/platform',
      health_score: 45
    });

    expect(result.status).toBe('blocked');
    expect(result.reasons).toContain('health_score_below_threshold');
    expect(result.reasons).toContain('tests_not_passed');
  });
});
