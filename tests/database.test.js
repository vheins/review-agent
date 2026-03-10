import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { DatabaseManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DatabaseManager Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test');
  const testDbPath = path.join(testDbDir, 'test-init.db');

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('Property 20: Database should initialize with all required tables and indexes', async () => {
    const manager = new DatabaseManager(testDbPath);
    const success = await manager.initialize();
    
    expect(success).toBe(true);
    expect(manager.isAvailable()).toBe(true);

    const tables = manager.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    
    const requiredTables = [
      'pull_requests', 'review_sessions', 'review_comments', 
      'developers', 'repositories', 'expertise_areas',
      'pr_metrics', 'developer_metrics', 'custom_rules',
      'false_positives', 'security_findings', 'audit_trail',
      'auto_fix_attempts', 'test_runs', 'notifications',
      'repository_config'
    ];

    for (const table of requiredTables) {
      expect(tables).toContain(table);
    }

    // Verify indexes exist (Requirements 41.2)
    const indexes = manager.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(i => i.name);
    expect(indexes.length).toBeGreaterThan(0);
    
    // Check some critical indexes from schema.sql
    expect(indexes).toContain('idx_pr_status');
    expect(indexes).toContain('idx_review_status');
    expect(indexes).toContain('idx_audit_timestamp');

    manager.close();
  });

  it('Property 20: Query performance with indexes', async () => {
    const manager = new DatabaseManager(testDbPath);
    await manager.initialize();

    // Use fast-check to generate many PRs and check query speed
    await fc.assert(
      fc.asyncProperty(fc.array(fc.record({
        github_pr_id: fc.integer({min: 1, max: 1000000}),
        title: fc.string(),
        status: fc.constantFrom('open', 'merged', 'closed', 'rejected')
      }), { minLength: 10, maxLength: 50 }), async (prs) => {
        
        // Insert PRs in a transaction for speed
        manager.transaction(() => {
          const stmt = manager.db.prepare(`
            INSERT OR IGNORE INTO pull_requests 
            (github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
            VALUES (?, 1, 1, ?, ?, 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);
          for (const pr of prs) {
            stmt.run(pr.github_pr_id, pr.title, pr.status);
          }
        })();

        // Query by status (which is indexed)
        const start = performance.now();
        const results = manager.db.prepare("SELECT * FROM pull_requests WHERE status = 'open'").all();
        const end = performance.now();

        // Performance check: query should be very fast with indexes
        expect(end - start).toBeLessThan(10); // Should be sub-10ms for small dataset
        
        return true;
      }),
      { numRuns: 5 } // Keep runs low for CI efficiency but enough to verify
    );

    manager.close();
  });
});
