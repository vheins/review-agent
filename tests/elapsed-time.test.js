import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { ElapsedTimeTracker } from '../src/elapsed-time-tracker.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ElapsedTimeTracker Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-elapsed');
  const testDbPath = path.join(testDbDir, 'test-elapsed.db');

  let tracker;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    
    dbManager.db = testDbManager.db;
    tracker = new ElapsedTimeTracker();

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

  it('Property 9: Elapsed Time Accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 100000 }), // Elapsed seconds
        async (elapsedSeconds) => {
          testDbManager.db.prepare('DELETE FROM pull_requests').run();
          
          const now = new Date();
          const createdAt = new Date(now.getTime() - (elapsedSeconds * 1000));
          
          testDbManager.db.prepare(`
            INSERT INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
            VALUES (1, 501, 1, 1, 'PR 1', 'open', 'feat', 'main', ?, ?)
          `).run(createdAt.toISOString(), createdAt.toISOString());

          const result = await tracker.calculateElapsedTime(1);
          
          // Allow for 1 second variance due to execution time
          expect(result.elapsedSeconds).toBeGreaterThanOrEqual(elapsedSeconds - 1);
          expect(result.elapsedSeconds).toBeLessThanOrEqual(elapsedSeconds + 1);
          
          const statusResult = await tracker.calculateTimeInCurrentStatus(1);
          expect(statusResult.timeInStatusSeconds).toBeGreaterThanOrEqual(elapsedSeconds - 1);
          expect(statusResult.timeInStatusSeconds).toBeLessThanOrEqual(elapsedSeconds + 1);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});
