import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { MetricsEngine } from '../src/metrics-engine.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MetricsEngine Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-metrics');
  const testDbPath = path.join(testDbDir, 'test-metrics.db');
  const validDateArbitrary = (min, max) => fc.date({ min, max }).filter((value) => !Number.isNaN(value.getTime()));

  let engine;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    
    // Inject our test DB manager
    dbManager.db = testDbManager.db;
    engine = new MetricsEngine();

    // Seed common required data for all tests
    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
      VALUES (1, 101, 1, 1, 'Test PR', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('Property 1: Review Duration Persistence', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDateArbitrary(new Date('2020-01-01'), new Date('2025-12-31')), // Start time
        fc.integer({ min: 1, max: 3600 }), // Duration in seconds
        async (startDate, duration) => {
          // Clear for clean run
          testDbManager.db.prepare('DELETE FROM pr_metrics').run();
          testDbManager.db.prepare('DELETE FROM review_sessions').run();

          const startTime = startDate.toISOString();
          const endTime = new Date(startDate.getTime() + duration * 1000).toISOString();
          
          const prId = 1;
          const sessionId = await engine.recordReview(prId, 'gemini', startTime, endTime, 'approved');
          
          const session = testDbManager.db.prepare('SELECT duration_seconds FROM review_sessions WHERE id = ?').get(sessionId);
          expect(session.duration_seconds).toBe(duration);
          
          const metric = testDbManager.db.prepare("SELECT metric_value FROM pr_metrics WHERE pr_id = ? AND metric_type = 'review_duration' ORDER BY recorded_at DESC").get(prId);
          expect(metric.metric_value).toBe(duration);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 6: Time-to-Merge Calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDateArbitrary(new Date('2020-01-01'), new Date('2025-12-31')), // Creation time
        fc.integer({ min: 100, max: 100000 }), // Time to merge in seconds
        async (createDate, mergeDuration) => {
          const createdAt = createDate.toISOString();
          const mergedAt = new Date(createDate.getTime() + mergeDuration * 1000).toISOString();
          
          // Use unique github_pr_id per run
          const githubPrId = Math.floor(Math.random() * 1000000);
          
          const result = testDbManager.db.prepare(`
            INSERT INTO pull_requests (github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at, merged_at)
            VALUES (?, 1, 1, 'Merge PR', 'merged', 'feat', 'main', ?, ?, ?)
          `).run(githubPrId, createdAt, createdAt, mergedAt);
          
          const prId = result.lastInsertRowid;
          const calculated = await engine.calculateTimeToMerge(prId);
          
          expect(calculated).toBe(mergeDuration);
          
          const pr = testDbManager.db.prepare('SELECT time_to_merge_seconds FROM pull_requests WHERE id = ?').get(prId);
          expect(pr.time_to_merge_seconds).toBe(mergeDuration);
          
          return true;
        }
      ),
      { numRuns: 5 }
    );
  });

  it('Property 2: Metrics Calculation Performance', async () => {
    // Seed 100 sessions
    testDbManager.db.prepare('DELETE FROM review_sessions').run();
    const stmt = testDbManager.db.prepare(`
      INSERT INTO review_sessions (pr_id, executor_type, status, started_at, completed_at, duration_seconds, outcome)
      VALUES (1, 'gemini', 'completed', '2023-01-01', '2023-01-01', ?, ?)
    `);
    
    testDbManager.transaction(() => {
      for (let i = 0; i < 100; i++) {
        stmt.run(Math.floor(Math.random() * 1000), i % 2 === 0 ? 'approved' : 'rejected');
      }
    })();

    const start = performance.now();
    const stats = await engine.calculateMetrics();
    const end = performance.now();

    expect(stats.total_reviews).toBe(100);
    expect(end - start).toBeLessThan(50); // Should be very fast
  });

  it('Property 3: Time Range Filtering', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDateArbitrary(new Date('2023-01-01'), new Date('2023-01-10')),
        validDateArbitrary(new Date('2023-01-11'), new Date('2023-01-20')),
        async (dateIn, dateOut) => {
          testDbManager.db.prepare('DELETE FROM review_sessions').run();
          
          // One inside range
          testDbManager.db.prepare(`
            INSERT INTO review_sessions (pr_id, executor_type, status, started_at, completed_at, duration_seconds, outcome)
            VALUES (1, 'gemini', 'completed', ?, ?, 100, 'approved')
          `).run(dateIn.toISOString(), dateIn.toISOString());

          // One outside range
          testDbManager.db.prepare(`
            INSERT INTO review_sessions (pr_id, executor_type, status, started_at, completed_at, duration_seconds, outcome)
            VALUES (1, 'gemini', 'completed', ?, ?, 100, 'approved')
          `).run(dateOut.toISOString(), dateOut.toISOString());

          const stats = await engine.calculateMetrics({
            startDate: '2023-01-01',
            endDate: '2023-01-10'
          });

          expect(stats.total_reviews).toBe(1);
          return true;
        }
      ),
      { numRuns: 5 }
    );
  });

  describe('Trend Analysis and Anomaly Detection', () => {
    it('Should detect increasing trend', async () => {
      testDbManager.db.prepare('DELETE FROM review_sessions').run();
      
      const stmt = testDbManager.db.prepare(`
        INSERT INTO review_sessions (pr_id, executor_type, status, started_at, completed_at, duration_seconds, outcome)
        VALUES (1, 'gemini', 'completed', ?, ?, ?, 'approved')
      `);

      stmt.run('2023-01-01T10:00:00Z', '2023-01-01T11:00:00Z', 100);
      stmt.run('2023-01-02T10:00:00Z', '2023-01-02T11:00:00Z', 150);
      stmt.run('2023-01-03T10:00:00Z', '2023-01-03T11:00:00Z', 200);

      const analysis = await engine.getTrendAnalysis('review_duration', 'day');
      expect(analysis.trend).toBe('increasing');
      expect(analysis.percentage_change).toBeGreaterThan(0);
    });

    it('Should detect anomalies with known outliers', async () => {
      testDbManager.db.prepare('DELETE FROM pr_metrics').run();
      
      const stmt = testDbManager.db.prepare(`
        INSERT INTO pr_metrics (pr_id, metric_type, metric_value, metric_unit, recorded_at)
        VALUES (1, 'review_duration', ?, 'seconds', '2023-01-01T00:00:00Z')
      `);

      // Normal data
      for (let i = 0; i < 20; i++) {
        stmt.run(100 + (Math.random() * 20 - 10)); // ~100
      }
      
      // Outlier
      stmt.run(500); 

      const anomalies = await engine.detectAnomalies('review_duration');
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.metric_value === 500)).toBe(true);
    });
  });

  describe('Developer and Repository Metrics', () => {
    it('Should calculate developer metrics correctly', async () => {
      testDbManager.db.prepare('DELETE FROM review_sessions').run();
      
      const stmt = testDbManager.db.prepare(`
        INSERT INTO review_sessions (pr_id, executor_type, status, started_at, completed_at, duration_seconds, outcome)
        VALUES (1, 'gemini', 'completed', '2023-01-01', '2023-01-01', 100, ?)
      `);

      stmt.run('approved');
      stmt.run('approved');
      stmt.run('rejected');
      stmt.run('needs_changes');

      const devMetrics = await engine.getDeveloperMetrics(1); // Author ID 1
      expect(devMetrics.review_count).toBe(4);
      expect(devMetrics.avg_review_time).toBe(100);
      expect(devMetrics.approval_rate).toBe(50); // 2/4
      expect(devMetrics.rejection_rate).toBe(25); // 1/4
    });

    it('Should calculate repository metrics correctly', async () => {
      // Add another PR for the same repo
      testDbManager.db.prepare(`
        INSERT OR IGNORE INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at, time_to_merge_seconds, health_score)
        VALUES (2, 102, 1, 1, 'Test PR 2', 'merged', 'feat2', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 3600, 80)
      `).run();
      
      testDbManager.db.prepare('UPDATE pull_requests SET time_to_merge_seconds = 7200, health_score = 90 WHERE id = 1').run();

      const repoMetrics = await engine.getRepositoryMetrics(1);
      expect(repoMetrics.pr_volume).toBeGreaterThanOrEqual(2);
      expect(repoMetrics.avg_time_to_merge).toBe(5400); // (3600 + 7200) / 2
      expect(repoMetrics.avg_health_score).toBe(85); // (80 + 90) / 2
    });
  });
});
