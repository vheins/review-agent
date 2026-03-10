import { dbManager } from './database.js';
import { logger } from './logger.js';

export class GamificationEngine {
  constructor() {
    this.pointsConfig = {
      review_completed: 50,
      approved_pr: 20,
      bug_found: 10,
      security_issue_found: 100,
      streak_bonus: 10
    };
  }

  async awardPoints(developerId, activityType, pointsOverride = null) {
    if (!dbManager.isAvailable()) return;

    const points = pointsOverride !== null ? pointsOverride : (this.pointsConfig[activityType] || 0);
    if (points === 0) return;

    dbManager.db.prepare(
      'UPDATE developers SET gamification_points = gamification_points + ? WHERE id = ?'
    ).run(points, developerId);

    logger.info(`Awarded ${points} points to developer ${developerId} for ${activityType}`);
    
    // Check for achievements
    await this.checkAchievements(developerId);
  }

  async checkAchievements(developerId) {
    if (!dbManager.isAvailable()) return;

    const dev = dbManager.db.prepare('SELECT gamification_points FROM developers WHERE id = ?').get(developerId);
    if (!dev) return;

    // Hardcoded simple achievement logic
    if (dev.gamification_points >= 1000) {
      await this.awardAchievement(developerId, 'centurion', 'Reach 1000 points');
    }
    
    const reviewCount = dbManager.db.prepare(`
      SELECT COUNT(*) as count FROM pr_reviewers WHERE developer_id = ? AND status != 'pending'
    `).get(developerId).count;

    if (reviewCount >= 10) {
      await this.awardAchievement(developerId, 'reviewer_level_1', 'Complete 10 reviews');
    }
  }

  async awardAchievement(developerId, achievementId, description = '') {
    // Check if already awarded
    const exists = dbManager.db.prepare(
      'SELECT 1 FROM developer_achievements WHERE developer_id = ? AND achievement_id = ?'
    ).get(developerId, achievementId);

    if (exists) return;

    // Ensure achievement exists in table
    dbManager.db.prepare(`
      INSERT OR IGNORE INTO achievements (id, name, description, points_reward)
      VALUES (?, ?, ?, 0)
    `).run(achievementId, achievementId.replace(/_/g, ' ').toUpperCase(), description);

    dbManager.db.prepare(`
      INSERT INTO developer_achievements (developer_id, achievement_id, awarded_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(developerId, achievementId);

    logger.info(`Achievement UNLOCKED for developer ${developerId}: ${achievementId}`);
  }

  async getLeaderboard(limit = 10) {
    if (!dbManager.isAvailable()) return [];

    return dbManager.db.prepare(`
      SELECT id, github_username, gamification_points 
      FROM developers 
      ORDER BY gamification_points DESC 
      LIMIT ?
    `).all(limit);
  }
}

export const gamificationEngine = new GamificationEngine();
export default gamificationEngine;
