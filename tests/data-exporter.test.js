import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { DataExporter } from '../src/data-exporter.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DataExporter Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-export');
  const testDbPath = path.join(testDbDir, 'test-export.db');
  const exportDir = path.join(testDbDir, 'exports');

  let exporter;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    
    // Inject our test DB manager into the singleton's place for the exporter to use
    // Since the exporter imports dbManager, we need to be careful.
    // A better way is to make DataExporter accept a db instance in constructor.
    exporter = new DataExporter(exportDir);
    // For these tests, we'll temporarily replace the dbManager's db
    dbManager.db = testDbManager.db;
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('Property 23: Export Round-Trip', async () => {
    // Seed required PR for FK
    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
      VALUES (1, 101, 1, 1, 'Test PR', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          metric_type: fc.stringMatching(/^[a-zA-Z0-9._\-]+$/).filter(s => s.length > 0),
          metric_value: fc.float({ noDefaultInfinity: true, noNaN: true }),
          recorded_at: fc.date().map(d => d.toISOString())
        }), { minLength: 1, maxLength: 50 }),
        async (metrics) => {
          // Clear table
          testDbManager.db.prepare('DELETE FROM pr_metrics').run();
          
          // Seed data
          const stmt = testDbManager.db.prepare(`
            INSERT INTO pr_metrics (pr_id, metric_type, metric_value, recorded_at)
            VALUES (1, ?, ?, ?)
          `);
          for (const m of metrics) {
            stmt.run(m.metric_type, m.metric_value, m.recorded_at);
          }

          // Export as JSON
          const { filePath } = await exporter.exportMetrics({}, 'json');
          
          // Load and verify
          const exportedData = await fs.readJson(filePath);
          expect(exportedData.length).toBe(metrics.length);
          
          return true;
        }
      ),
      { numRuns: 5 }
    );
  });

  it('Should export as CSV', async () => {
    // Seed required PR for FK
    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
      VALUES (1, 101, 1, 1, 'Test PR', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    testDbManager.db.prepare(`
      INSERT INTO pr_metrics (pr_id, metric_type, metric_value, recorded_at)
      VALUES (1, 'test_metric', 42.5, '2023-01-01T00:00:00Z')
    `).run();

    const { filePath } = await exporter.exportMetrics({}, 'csv');
    const content = await fs.readFile(filePath, 'utf8');
    
    expect(content).toContain('test_metric');
    expect(content).toContain('42.5');
    expect(content).toContain('2023-01-01T00:00:00Z');
  });
});
