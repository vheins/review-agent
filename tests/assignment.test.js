import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { AssignmentEngine } from '../src/assignment-engine.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AssignmentEngine Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-assignments');
  const testDbPath = path.join(testDbDir, 'test-assignments.db');

  let assignmentEngine;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    
    dbManager.db = testDbManager.db;
    assignmentEngine = new AssignmentEngine();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('Property 7: Reviewer Assignment Bounds', async () => {
    // We want to verify that assignReviewers always assigns between 1 and 3 reviewers
    // as long as there are enough available developers.
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Number of available developers
        fc.array(fc.string({ minLength: 5 }), { minLength: 1, maxLength: 5 }), // Files
        async (numDevs, files) => {
          testDbManager.db.prepare('DELETE FROM pr_reviewers').run();
          testDbManager.db.prepare('DELETE FROM review_sessions').run();
          testDbManager.db.prepare('DELETE FROM pull_requests').run();
          testDbManager.db.prepare('DELETE FROM expertise_areas').run();
          testDbManager.db.prepare('DELETE FROM developers').run();
          
          testDbManager.db.prepare(`
            INSERT OR IGNORE INTO repositories (id, github_repo_id, owner, name, full_name, default_branch, created_at, updated_at)
            VALUES (1, 101, 'system', 'test', 'system/test', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run();

          const insertDev = testDbManager.db.prepare(`
            INSERT INTO developers (id, github_username, is_available, current_workload_score, created_at, updated_at)
            VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);

          for (let i = 1; i <= numDevs; i++) {
            insertDev.run(i, `dev${i}`, Math.random() * 100);
          }

          // We need a pull request to assign reviewers to
          testDbManager.db.prepare(`
            INSERT OR IGNORE INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
            VALUES (1, 301, 1, 1, 'PR 1', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run();

          // Let's assume the author is not among the available ones, or we don't pass an authorId
          const assignedIds = await assignmentEngine.assignReviewers(1, files);

          // Expected behavior: assign up to 3, but at most numDevs
          const expectedNum = Math.min(3, numDevs);
          expect(assignedIds.length).toBe(expectedNum);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  describe('Expertise Tracking', () => {
    it('Should update expertise scores correctly', async () => {
      // Create dev
      testDbManager.db.prepare('DELETE FROM expertise_areas').run();
      testDbManager.db.prepare('DELETE FROM developers').run();
      testDbManager.db.prepare(`
        INSERT OR IGNORE INTO developers (id, github_username, is_available, current_workload_score, created_at, updated_at)
        VALUES (1, 'expert_dev', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      await assignmentEngine.updateExpertise(1, ['src/app.js', 'src/utils/math.js']);

      const expertise = testDbManager.db.prepare('SELECT * FROM expertise_areas WHERE developer_id = 1').all();
      
      // Should have extracted patterns: *.js, src/*, src/utils/*
      expect(expertise.length).toBeGreaterThan(0);
      
      // Should have score of 1.0 initially
      const jsExpertise = expertise.find(e => e.file_pattern === '*.js');
      expect(jsExpertise).toBeDefined();
      // It might be 2.0 if *.js was added twice in the same loop due to Set handling (Wait, Set handles uniqueness within one update loop)
      // Actually it's updated once per pattern per transaction loop, so score should be 1.0
      expect(jsExpertise.expertise_score).toBe(1.0);

      // Now update again
      await assignmentEngine.updateExpertise(1, ['src/app.js']);
      
      const newExpertise = testDbManager.db.prepare('SELECT * FROM expertise_areas WHERE developer_id = 1 AND file_pattern = ?').get('*.js');
      
      // Old score (1.0) * 0.9 = 0.9 + 1.0 = 1.9
      expect(newExpertise.expertise_score).toBe(1.9);
      expect(newExpertise.contribution_count).toBe(2);
    });
  });

  describe('Workload Management', () => {
    it('Should calculate and update workload correctly', async () => {
      // Clear tables
      testDbManager.db.prepare('DELETE FROM pr_reviewers').run();
      testDbManager.db.prepare('DELETE FROM pull_requests').run();
      testDbManager.db.prepare('DELETE FROM developers').run();
      
      // Create dev
      testDbManager.db.prepare(`
        INSERT OR IGNORE INTO developers (id, github_username, is_available, current_workload_score, created_at, updated_at)
        VALUES 
          (1, 'worker_dev', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (2, 'worker_dev2', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      // Create 2 pending reviews for dev 1
      testDbManager.db.prepare(`
        INSERT OR IGNORE INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
        VALUES 
          (1, 201, 1, 2, 'PR 1', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (2, 202, 1, 2, 'PR 2', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
      
      testDbManager.db.prepare(`
        INSERT OR IGNORE INTO pr_reviewers (pr_id, developer_id, status, assigned_at)
        VALUES 
          (1, 1, 'pending', CURRENT_TIMESTAMP),
          (2, 1, 'pending', CURRENT_TIMESTAMP)
      `).run();

      // Create 1 authored open PR for dev 1
      testDbManager.db.prepare(`
        INSERT OR IGNORE INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
        VALUES (3, 203, 1, 1, 'PR 3', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      // Expected workload: 2 pending * 10 + 1 authored * 5 = 25
      const workload = await assignmentEngine.calculateWorkloadScore(1);
      expect(workload).toBe(25);

      const savedWorkload = await assignmentEngine.getWorkload(1);
      expect(savedWorkload).toBe(25);

      const dev = testDbManager.db.prepare('SELECT current_workload_score FROM developers WHERE id = 1').get();
      expect(dev.current_workload_score).toBe(25);
    });
  });

  describe('Availability Management', () => {
    it('Should manage developer availability and auto-restore', async () => {
      testDbManager.db.prepare('DELETE FROM pr_reviewers').run();
      testDbManager.db.prepare('DELETE FROM pull_requests').run();
      testDbManager.db.prepare('DELETE FROM developers').run();
      
      testDbManager.db.prepare(`
        INSERT OR IGNORE INTO developers (id, github_username, is_available, current_workload_score, created_at, updated_at)
        VALUES (1, 'avail_dev', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      expect(await assignmentEngine.checkAvailability(1)).toBe(true);

      // Set unavailable until future
      const future = new Date();
      future.setHours(future.getHours() + 1);
      await assignmentEngine.setAvailability(1, false, future.toISOString());
      
      expect(await assignmentEngine.checkAvailability(1)).toBe(false);

      // Set unavailable until past
      const past = new Date();
      past.setHours(past.getHours() - 1);
      await assignmentEngine.setAvailability(1, false, past.toISOString());
      
      // Should auto-restore
      expect(await assignmentEngine.checkAvailability(1)).toBe(true);
    });
  });
});
