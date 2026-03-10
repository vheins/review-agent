import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notificationService } from '../src/notification-service.js';
import { escalationService } from '../src/escalation-service.js';
import { DatabaseManager, dbManager } from '../src/database.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Communication Services', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-comm');
  const testDbPath = path.join(testDbDir, 'test-comm.db');

  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;

    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO developers (id, github_username, role, notification_preferences, created_at, updated_at)
      VALUES (1, 'dev1', 'developer', '{"enabled": true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
             (2, 'lead1', 'lead', '{"enabled": true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  describe('NotificationService', () => {
    it('Should send notification and respect preferences', async () => {
      const notifId = await notificationService.sendNotification(1, 'pr_event', 'Title', 'Message');
      expect(notifId).toBeDefined();

      const unread = await notificationService.getUnreadNotifications(1);
      expect(unread.length).toBe(1);

      // Test suppression
      testDbManager.db.prepare("UPDATE developers SET notification_preferences = ? WHERE id = 1")
        .run(JSON.stringify({ enabled: false }));
      
      const suppressedId = await notificationService.sendNotification(1, 'pr_event', 'Title', 'Message');
      expect(suppressedId).toBeNull();
    });
  });

  describe('EscalationService', () => {
    it('Should escalate to lead role', async () => {
      await escalationService.escalate(101, 'pull_request', 'SLA Breached', 'high');
      
      const audit = testDbManager.db.prepare("SELECT * FROM audit_trail WHERE action_type = 'escalation'").get();
      expect(audit).toBeDefined();
      expect(JSON.parse(audit.action_details).level).toBe('lead');

      // Lead should have received notification
      const notifs = await notificationService.getUnreadNotifications(2); // lead1
      expect(notifs.length).toBe(1);
      expect(notifs[0].notification_type).toBe('escalation');
    });
  });
});
