import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { configManager } from '../src/config.js';
import { dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ConfigurationManager Property Tests', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-config');
  const testDbPath = path.join(testDbDir, 'test-config.db');

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    // Initialize a separate database for config tests
    dbManager.dbPath = testDbPath;
    await dbManager.initialize();
  });

  afterEach(async () => {
    dbManager.close();
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('Property 22: Configuration Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          reviewInterval: fc.integer({ min: 60, max: 3600 }),
          logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
          aiExecutor: fc.constantFrom('gemini', 'copilot', 'kiro'),
          autoMerge: fc.boolean()
        }),
        async (testConfig) => {
          const repoId = 1; // Use the seeded repository ID to avoid FK failure
          // Save config
          await configManager.saveRepoConfig(repoId, testConfig, 'test-user');
          
          // Load config
          const loadedConfig = await configManager.getRepoConfig(repoId);
          
          // Verify merged config contains our values
          expect(loadedConfig.reviewInterval).toBe(testConfig.reviewInterval);
          expect(loadedConfig.logLevel).toBe(testConfig.logLevel);
          expect(loadedConfig.aiExecutor).toBe(testConfig.aiExecutor);
          expect(loadedConfig.autoMerge).toBe(testConfig.autoMerge);
          
          // Verify audit trail entry exists
          const audit = dbManager.db.prepare('SELECT * FROM audit_trail WHERE resource_id = ?').get(repoId.toString());
          expect(audit).toBeDefined();
          expect(audit.action_type).toBe('config_update');
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Should load from JSON file', async () => {
    const jsonPath = path.join(testDbDir, 'config.json');
    const testData = { reviewInterval: 999, logLevel: 'debug' };
    await fs.writeJson(jsonPath, testData);

    const loaded = await configManager.loadFromFile(jsonPath);
    expect(loaded.reviewInterval).toBe(testData.reviewInterval);
    expect(loaded.logLevel).toBe(testData.logLevel);
  });

  it('Should load from YAML file', async () => {
    const yamlPath = path.join(testDbDir, 'config.yaml');
    const testData = "reviewInterval: 888\nlogLevel: warn";
    await fs.writeFile(yamlPath, testData);

    const loaded = await configManager.loadFromFile(yamlPath);
    expect(loaded.reviewInterval).toBe(888);
    expect(loaded.logLevel).toBe('warn');
  });
});
