import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { QualityScorer } from '../src/quality-scorer.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('QualityScorer', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-quality');
  const testDbPath = path.join(testDbDir, 'test-quality.db');

  let scorer;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;
    scorer = new QualityScorer();

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
      VALUES (1, 801, 1, 1, 'PR 1', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('Property 10: Quality Score Bounds', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            issue_type: fc.string({ maxLength: 10 }),
            severity: fc.constantFrom('critical', 'error', 'high', 'warning', 'info', 'low'),
            message: fc.string({ maxLength: 100 }),
            suggested_fix: fc.oneof(fc.constant(null), fc.string({ maxLength: 20 })),
            is_auto_fixable: fc.boolean()
          }),
          { maxLength: 50 }
        ),
        fc.integer({ min: 0, max: 50 }),
        (comments, fpCount) => {
          const actualFpCount = Math.min(fpCount, comments.length);
          const scores = scorer.calculateScores(comments, actualFpCount);
          
          expect(scores.thoroughness).toBeGreaterThanOrEqual(0);
          expect(scores.thoroughness).toBeLessThanOrEqual(100);
          expect(scores.helpfulness).toBeGreaterThanOrEqual(0);
          expect(scores.helpfulness).toBeLessThanOrEqual(100);
          expect(scores.accuracy).toBeGreaterThanOrEqual(0);
          expect(scores.accuracy).toBeLessThanOrEqual(100);
          expect(scores.finalScore).toBeGreaterThanOrEqual(0);
          expect(scores.finalScore).toBeLessThanOrEqual(100);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Should calculate 100 accuracy for 0 false positives', () => {
    const scores = scorer.calculateScores([{ severity: 'high' }], 0);
    expect(scores.accuracy).toBe(100);
  });

  describe('Quality Trends', () => {
    it('Should detect improving quality trends', async () => {
      const stmt = testDbManager.db.prepare(`
        INSERT INTO review_sessions (pr_id, executor_type, status, started_at, completed_at, quality_score)
        VALUES (1, 'gemini', 'completed', ?, ?, ?)
      `);

      stmt.run('2023-01-01T10:00:00Z', '2023-01-01T11:00:00Z', 70);
      stmt.run('2023-01-02T10:00:00Z', '2023-01-02T11:00:00Z', 80);

      const trends = await scorer.getQualityTrends();
      expect(trends.length).toBe(1);
      expect(trends[0].executor).toBe('gemini');
      expect(trends[0].trend).toBe('improving');
      expect(trends[0].change).toBe(10);
    });
  });
});
