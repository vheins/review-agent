import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseManager, dbManager } from '../src/database.js';
import { AppError, ErrorLogger } from '../src/error-handler.js';
import { ResponseCache } from '../src/response-cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Platform Services', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-platform-services');
  const testDbPath = path.join(testDbDir, 'test-platform-services.db');

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
    vi.restoreAllMocks();
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  it('stores structured errors in the database', () => {
    const logger = new ErrorLogger({
      dbManager,
      logger: { error: vi.fn() },
      wsManager: { broadcast: vi.fn() }
    });

    logger.log(new AppError('Repository missing', 404, 'REPOSITORY_NOT_FOUND'), {
      requestPath: '/api/repos/1',
      requestMethod: 'GET',
      actorId: 'tester'
    });

    const row = testDbManager.db.prepare('SELECT * FROM error_logs ORDER BY id DESC LIMIT 1').get();
    expect(row.code).toBe('REPOSITORY_NOT_FOUND');
    expect(row.request_path).toBe('/api/repos/1');
    expect(row.request_method).toBe('GET');
    expect(row.actor_id).toBe('tester');
  });

  it('expires cache entries after ttl', async () => {
    const cache = new ResponseCache(10);
    cache.set('metrics:overview', { total: 10 }, 10);

    expect(cache.get('metrics:overview')).toEqual({ total: 10 });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(cache.get('metrics:overview')).toBeNull();
  });
});
