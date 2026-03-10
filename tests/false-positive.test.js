import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { FalsePositiveTracker } from '../src/false-positive-tracker.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FalsePositiveTracker Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-fp');
  const testDbPath = path.join(testDbDir, 'test-fp.db');

  let tracker;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    
    dbManager.db = testDbManager.db;
    tracker = new FalsePositiveTracker();

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
  });

  it('Property 11: False Positive Recording', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 100 }), // Justification
        async (justification) => {
          testDbManager.db.prepare('DELETE FROM false_positives').run();
          testDbManager.db.prepare('DELETE FROM review_comments').run();
          testDbManager.db.prepare('DELETE FROM review_sessions').run();
          testDbManager.db.prepare('DELETE FROM pull_requests').run();
          
          testDbManager.db.prepare(`
            INSERT INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
            VALUES (1, 601, 1, 1, 'PR 1', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run();

          testDbManager.db.prepare(`
            INSERT INTO review_sessions (id, pr_id, executor_type, status, started_at, false_positive_count)
            VALUES (1, 1, 'gemini', 'completed', CURRENT_TIMESTAMP, 0)
          `).run();

          testDbManager.db.prepare(`
            INSERT INTO review_comments (id, review_session_id, file_path, issue_type, severity, message, created_at)
            VALUES (1, 1, 'test.js', 'security', 'high', 'Test comment', CURRENT_TIMESTAMP)
          `).run();

          const fpId = await tracker.markFalsePositive(1, 1, justification);
          
          const fp = testDbManager.db.prepare('SELECT justification FROM false_positives WHERE id = ?').get(fpId);
          expect(fp.justification).toBe(justification);
          
          const session = testDbManager.db.prepare('SELECT false_positive_count FROM review_sessions WHERE id = 1').get();
          expect(session.false_positive_count).toBe(1);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});
