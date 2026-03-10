import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checklistManager } from '../src/checklist-manager.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ChecklistManager', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-checklists');
  const testDbPath = path.join(testDbDir, 'test-checklists.db');

  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;

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

  it('Should create and retrieve checklists', async () => {
    const items = [
      { text: 'Security check', priority: 'high', category: 'security' },
      { text: 'Style check', priority: 'normal', category: 'style' }
    ];

    const checklistId = await checklistManager.createChecklist(1, 'Standard Review', 'Standard review steps', items);
    expect(checklistId).toBeDefined();

    const checklists = await checklistManager.getChecklistsForRepository(1);
    expect(checklists.length).toBe(1);
    expect(checklists[0].name).toBe('Standard Review');

    const retrievedItems = await checklistManager.getChecklistItems(checklistId);
    expect(retrievedItems.length).toBe(2);
    expect(retrievedItems[0].item_text).toBe('Security check');
  });

  it('Should track checklist completion', async () => {
    const checklistId = await checklistManager.createChecklist(1, 'Test', 'Test', [{ text: 'Task 1' }]);
    
    // Seed PR
    testDbManager.db.prepare(`
      INSERT INTO pull_requests (id, github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
      VALUES (1, 701, 1, 1, 'PR 1', 'open', 'feat', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    // Create session
    testDbManager.db.prepare(`
      INSERT INTO review_sessions (id, pr_id, executor_type, status, started_at)
      VALUES (1, 1, 'gemini', 'completed', CURRENT_TIMESTAMP)
    `).run();

    await checklistManager.attachChecklistsToReview(1, 1);
    
    const status = await checklistManager.getReviewChecklistStatus(1);
    expect(status.total).toBe(1);
    expect(status.completed).toBe(0);

    const itemId = status.items[0].checklist_item_id;
    await checklistManager.completeItem(1, itemId, 1, 'Done');

    const newStatus = await checklistManager.getReviewChecklistStatus(1);
    expect(newStatus.completed).toBe(1);
    expect(newStatus.completionPercentage).toBe(100);
  });
});
