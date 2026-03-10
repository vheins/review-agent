import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { developerDashboard } from '../src/developer-dashboard.js';
import { feedbackAnalyzer } from '../src/feedback-analyzer.js';
import { gamificationEngine } from '../src/gamification-engine.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Developer Experience Services', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-devex');
  const testDbPath = path.join(testDbDir, 'test-devex.db');

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
    
    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO developers (id, github_username, role, notification_preferences, created_at, updated_at)
      VALUES (1, 'dev1', 'developer', '{"enabled": true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  describe('GamificationEngine', () => {
    it('Should award points and unlock achievements', async () => {
      await gamificationEngine.awardPoints(1, 'review_completed');
      
      const dev = testDbManager.db.prepare('SELECT gamification_points FROM developers WHERE id = 1').get();
      expect(dev.gamification_points).toBe(50);

      // Award achievement manually for test
      await gamificationEngine.awardAchievement(1, 'first_review', 'Congratulations');
      
      const achievements = testDbManager.db.prepare('SELECT * FROM developer_achievements WHERE developer_id = 1').all();
      expect(achievements.length).toBe(1);
      expect(achievements[0].achievement_id).toBe('first_review');
    });
  });

  describe('DeveloperDashboard', () => {
    it('Should retrieve dashboard data', async () => {
      const data = await developerDashboard.getDashboardData(1);
      expect(data).toBeDefined();
      expect(data.points).toBe(0); // initially 0
    });
  });
});
