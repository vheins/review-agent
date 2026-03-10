import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutoFixService } from '../src/auto-fix-service.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AutoFixService', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-autofix');
  const testDbPath = path.join(testDbDir, 'test-autofix.db');
  const workspaceDir = path.join(testDbDir, 'workspace');

  let service;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    await fs.ensureDir(workspaceDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;
    service = new AutoFixService(workspaceDir);

    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO repositories (id, github_repo_id, owner, name, full_name, default_branch, created_at, updated_at)
      VALUES (1, 101, 'system', 'test', 'system/test', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
    
    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO developers (id, github_username, created_at, updated_at)
      VALUES (1, 'dev1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('Should identify fixable comments', () => {
    expect(service.isFixable({ is_auto_fixable: 1 })).toBe(true);
    expect(service.isFixable({ suggested_fix: 'const x = 1;' })).toBe(true);
    expect(service.isFixable({ is_auto_fixable: 0, suggested_fix: null })).toBe(false);
  });

  it('Should apply fixes to files', async () => {
    const repoDir = path.join(workspaceDir, 'repo1');
    await fs.ensureDir(repoDir);
    const testFile = path.join(repoDir, 'app.js');
    await fs.writeFile(testFile, 'const x = 1;\nconsole.log(x);');

    const fixes = [
      { file_path: 'app.js', line_number: 1, suggested_fix: 'const x = 2;' }
    ];

    const results = await service.applyFixes(repoDir, fixes);
    expect(results[0].status).toBe('applied');

    const newContent = await fs.readFile(testFile, 'utf8');
    expect(newContent).toBe('const x = 2;\nconsole.log(x);');
  });
});
