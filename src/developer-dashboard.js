import { dbManager } from './database.js';
import { metricsEngine } from './metrics-engine.js';
import { assignmentEngine } from './assignment-engine.js';

export class DeveloperDashboard {
  constructor() {}

  async getDashboardData(developerId) {
    if (!dbManager.isAvailable()) return null;

    // 1. Pending Reviews (Assigned but not completed)
    const pendingReviews = dbManager.db.prepare(`
      SELECT pr.*, r.full_name as repo_name, prv.assigned_at
      FROM pr_reviewers prv
      JOIN pull_requests pr ON prv.pr_id = pr.id
      JOIN repositories r ON pr.repository_id = r.id
      WHERE prv.developer_id = ? AND prv.status = 'pending'
      ORDER BY pr.priority_score DESC
    `).all(developerId);

    // 2. Personal Metrics
    const metrics = await metricsEngine.getDeveloperMetrics(developerId);

    // 3. Current Workload
    const workload = await assignmentEngine.getWorkload(developerId);

    // 4. Recent Achievements/Points
    const devInfo = dbManager.db.prepare(
      'SELECT gamification_points FROM developers WHERE id = ?'
    ).get(developerId);

    // 5. Unread Notifications
    const unreadCount = dbManager.db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND is_read = 0'
    ).get(developerId).count;

    return {
      developerId,
      pendingReviews,
      metrics,
      workload,
      points: devInfo ? devInfo.gamification_points : 0,
      unreadNotificationsCount: unreadCount,
      summary: {
        totalPending: pendingReviews.length,
        avgReviewTime: metrics ? metrics.avg_review_time : 0,
        approvalRate: metrics ? metrics.approval_rate : 0
      }
    };
  }
}

export const developerDashboard = new DeveloperDashboard();
export default developerDashboard;
