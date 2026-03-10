import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { retryStrategy } from '../src/retry-strategy.js';
import { taskLockManager } from '../src/task-lock-manager.js';
import { resourceManager } from '../src/resource-manager.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Reliability Services', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-rel');
  const testDbPath = path.join(testDbDir, 'test-rel.db');

  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  describe('RetryStrategy', () => {
    it('Should retry on retryable errors', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) throw new Error('rate limit reached');
        return 'success';
      };

      const strategy = new retryStrategy.constructor(3, 10); // short delay
      const result = await strategy.execute(fn, 'test');
      
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('Should fail on non-retryable errors', async () => {
      const fn = async () => { throw new Error('permanent error'); };
      const strategy = new retryStrategy.constructor(3, 10);
      
      await expect(strategy.execute(fn, 'test')).rejects.toThrow('permanent error');
    });
  });

  describe('TaskLockManager', () => {
    it('Should acquire and release locks', async () => {
      // Seed required data for FK
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
        VALUES (1, 1201, 1, 1, 'PR 1', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      // Seed session
      testDbManager.db.prepare(`
        INSERT INTO review_sessions (id, pr_id, executor_type, status, started_at)
        VALUES (1, 1, 'gemini', 'processing', CURRENT_TIMESTAMP)
      `).run();

      const manager = new taskLockManager.constructor('worker-1');
      const manager2 = new taskLockManager.constructor('worker-2');

      const locked = await manager.acquireLock(1);
      expect(locked).toBe(true);

      const lockedAgain = await manager2.acquireLock(1);
      expect(lockedAgain).toBe(false);

      await manager.releaseLock(1);
      const lockedBy2 = await manager2.acquireLock(1);
      expect(lockedBy2).toBe(true);
    });
  });

  describe('ResourceManager', () => {
    it('Should track and cleanup listeners', () => {
      const emitter = new EventEmitter();
      const manager = new resourceManager.constructor();
      let called = 0;
      const listener = () => { called++; };

      manager.on(emitter, 'test', listener);
      emitter.emit('test');
      expect(called).toBe(1);

      manager.cleanup();
      emitter.emit('test');
      expect(called).toBe(1); // should not increment
    });
  });
});
