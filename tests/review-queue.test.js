import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { ReviewQueue } from '../src/review-queue.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ReviewQueue Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-queue');
  const testDbPath = path.join(testDbDir, 'test-queue.db');

  let queue;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    
    dbManager.db = testDbManager.db;
    queue = new ReviewQueue();

    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO developers (id, github_username, is_available, current_workload_score, created_at, updated_at)
      VALUES (1, 'dev1', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
    
    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO repositories (id, github_repo_id, owner, name, full_name, default_branch, created_at, updated_at)
      VALUES (1, 101, 'system', 'test', 'system/test', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
    vi.restoreAllMocks();
  });

  it('Property 8: Priority Score Aging', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // Days old
        async (daysOld) => {
          testDbManager.db.prepare('DELETE FROM pull_requests').run();
          
          const now = new Date();
          const createdAt = new Date(now.getTime() - (daysOld * 24 * 60 * 60 * 1000));
          
          testDbManager.db.prepare(`
            INSERT INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at, is_blocking)
            VALUES (1, 401, 1, 1, 'PR 1', 'open', 'feat', 'main', ?, CURRENT_TIMESTAMP, 0)
          `).run(createdAt.toISOString());

          await queue.updatePriorityScores();

          const pr = testDbManager.db.prepare('SELECT priority_score FROM pull_requests WHERE id = 1').get();
          
          // Base score 10 + (daysOld * 10)
          expect(pr.priority_score).toBe(10 + (daysOld * 10));
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});
