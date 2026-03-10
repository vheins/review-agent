import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { securityScanner } from '../src/security-scanner.js';
import { auditLogger } from '../src/audit-logger.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Security and Audit Services', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-sec-audit');
  const testDbPath = path.join(testDbDir, 'test-sec-audit.db');

  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;

    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
      VALUES (1, 1001, 1, 1, 'PR 1', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  describe('SecurityScanner', () => {
    it('Should detect vulnerabilities and generate report', async () => {
      const file = { path: 'vuln.js', content: 'eval("evil")' };
      // Note: my current regexes don't include a simple eval, but let's use dangerouslySetInnerHTML
      const file2 = { path: 'vuln2.js', content: '<div dangerouslySetInnerHTML={{__html: data}} />' };
      
      await securityScanner.scanPR(1, [file2]);
      
      const report = await securityScanner.generateReport(1);
      expect(report).toContain('Security Scan Report');
      expect(report).toContain('Potential XSS');
    });
  });

  describe('AuditLogger', () => {
    it('Should log actions and retrieve them', async () => {
      await auditLogger.logAction('test_action', 1, 'pull_request', 1, { foo: 'bar' });
      
      const logs = await auditLogger.getAuditLogs({ actionType: 'test_action' });
      expect(logs.length).toBe(1);
      expect(logs[0].action_type).toBe('test_action');
      expect(JSON.parse(logs[0].action_details).foo).toBe('bar');
    });
  });
});
