import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { SecurityScanner } from '../src/security-scanner.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SecurityScanner Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-security');
  const testDbPath = path.join(testDbDir, 'test-security.db');

  let scanner;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;
    scanner = new SecurityScanner();

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
      VALUES (1, 901, 1, 1, 'PR 1', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('Property 15: Vulnerability Pattern Detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('dangerouslySetInnerHTML', 'query("SELECT * FROM users WHERE id = ${id}")'),
        async (vulnerableCode) => {
          const file = { path: 'vuln.js', content: vulnerableCode };
          const findings = await scanner.scanPR(1, [file]);
          
          expect(findings.length).toBeGreaterThan(0);
          expect(findings[0].finding_type).toBe('vulnerability');
          
          return true;
        }
      )
    );
  });

  it('Property 16: Sensitive Data Detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z0-9\-_]{16,32}$/),
        async (secret) => {
          const content = `const api_key = "${secret}";`;
          const file = { path: 'config.js', content };
          const findings = await scanner.scanPR(1, [file]);
          
          expect(findings.length).toBeGreaterThan(0);
          expect(findings[0].title).toBe('Hardcoded Secret');
          
          return true;
        }
      )
    );
  });
});
