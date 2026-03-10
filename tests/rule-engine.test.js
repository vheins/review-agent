import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { RuleEngine } from '../src/rule-engine.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RuleEngine Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-rules');
  const testDbPath = path.join(testDbDir, 'test-rules.db');

  let engine;
  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    
    dbManager.db = testDbManager.db;
    engine = new RuleEngine();

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

  it('Property 12: Regex Pattern Matching', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }), // Pattern keyword
        fc.string({ minLength: 10, maxLength: 100 }), // Prefix
        fc.string({ minLength: 10, maxLength: 100 }), // Suffix
        async (keyword, prefix, suffix) => {
          // Escaping keyword for regex if needed, but for simplicity we'll use alphanumeric
          const safeKeyword = keyword.replace(/[^a-zA-Z0-9]/g, '');
          if (safeKeyword.length < 3) return true;

          const content = `${prefix}\n${safeKeyword}\n${suffix}`;
          const file = { path: 'test.js', content };

          const rule = {
            id: 1,
            rule_name: 'Test Rule',
            rule_type: 'regex',
            pattern: safeKeyword,
            severity: 'error',
            message: 'Found keyword',
            auto_fixable: 0
          };

          const violations = [];
          engine.applyRegexRule(rule, file, violations);

          expect(violations.length).toBeGreaterThanOrEqual(1);
          expect(violations[0].message).toBe('Found keyword');
          expect(violations[0].line_number).toBe(2); // prefix is one line, keyword is on second
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Should handle AST matching for eval', () => {
    const file = {
      path: 'app.js',
      content: 'const x = 1;\neval("alert(1)");'
    };

    const rule = {
      id: 2,
      rule_name: 'No Eval',
      rule_type: 'ast',
      pattern: 'eval',
      severity: 'critical',
      message: 'Do not use eval()'
    };

    const violations = [];
    engine.applyASTRule(rule, file, violations);

    expect(violations.length).toBe(1);
    expect(violations[0].line_number).toBe(2);
    expect(violations[0].severity).toBe('critical');
  });

  it('Should filter rules by branch pattern', async () => {
    testDbManager.db.prepare('DELETE FROM custom_rules').run();
    testDbManager.db.prepare(`
      INSERT INTO custom_rules (repository_id, rule_name, rule_type, pattern, severity, message, enabled, branch_patterns, created_at, updated_at)
      VALUES (1, 'Main Only Rule', 'regex', 'TODO', 'info', 'Main branch only', 1, '["^main$"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    const file = { path: 'test.js', content: 'TODO: fix this' };
    
    const mainViolations = await engine.executeRules(1, 'main', [file]);
    expect(mainViolations.length).toBe(1);

    const featViolations = await engine.executeRules(1, 'feat/something', [file]);
    expect(featViolations.length).toBe(0);
  });

  describe('Rule Management', () => {
    it('Should validate rules correctly', () => {
      expect(() => engine.validateRule({ rule_name: '', rule_type: 'regex', pattern: '.*' })).toThrow('Rule name is required');
      expect(() => engine.validateRule({ rule_name: 'Test', rule_type: 'invalid', pattern: '.*' })).toThrow('Invalid rule type');
      expect(() => engine.validateRule({ rule_name: 'Test', rule_type: 'regex', pattern: '[' })).toThrow('Invalid regex pattern');
      expect(engine.validateRule({ rule_name: 'Test', rule_type: 'regex', pattern: 'valid' })).toBe(true);
    });

    it('Should test rules against sample code', async () => {
      const rule = { rule_type: 'regex', pattern: 'forbidden', severity: 'error', message: 'No forbidden' };
      const violations = await engine.testRule(rule, 'this is forbidden code');
      expect(violations.length).toBe(1);
      expect(violations[0].line_number).toBe(1);
    });

    it('Should save rules to database', async () => {
      const ruleData = {
        rule_name: 'DB Rule',
        rule_type: 'regex',
        pattern: 'DB_PATTERN',
        severity: 'warning',
        message: 'DB Message',
        enabled: true
      };

      const ruleId = await engine.saveRule(1, ruleData);
      expect(ruleId).toBeDefined();

      const saved = testDbManager.db.prepare('SELECT * FROM custom_rules WHERE id = ?').get(ruleId);
      expect(saved.rule_name).toBe('DB Rule');
      expect(saved.pattern).toBe('DB_PATTERN');
    });
  });
});
