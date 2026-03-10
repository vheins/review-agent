import { dbManager } from './database.js';
import { notificationService } from './notification-service.js';
import { escalationService } from './escalation-service.js';
import { logger } from './logger.js';

export class SLAMonitor {
  constructor() {}

  async checkAllSLAs() {
    if (!dbManager.isAvailable()) return;

    const openPRs = dbManager.db.prepare(`
      SELECT pr.*, r.sla_hours 
      FROM pull_requests pr
      JOIN repositories r ON pr.repository_id = r.id
      WHERE pr.status = 'open'
    `).all();

    for (const pr of openPRs) {
      await this.checkPR_SLA(pr);
    }
  }

  async checkPR_SLA(pr) {
    const now = new Date();
    const createdAt = new Date(pr.created_at);
    const slaMs = (pr.sla_hours || 24) * 60 * 60 * 1000;
    const elapsedMs = now - createdAt;
    
    const remainingMs = slaMs - elapsedMs;
    const progressPercent = (elapsedMs / slaMs) * 100;

    if (progressPercent >= 100) {
      // Breached - already handled by EscalationService, but we can double check
      await escalationService.escalate(pr.id, 'pull_request', `SLA of ${pr.sla_hours}h breached`, 'high');
    } else if (progressPercent >= 90) {
      await this.sendSLAWarning(pr, '90%', 'urgent');
    } else if (progressPercent >= 75) {
      await this.sendSLAWarning(pr, '75%', 'high');
    }
  }

  async sendSLAWarning(pr, threshold, priority) {
    // Notify assigned reviewers
    const reviewers = dbManager.db.prepare(`
      SELECT developer_id FROM pr_reviewers 
      WHERE pr_id = ? AND status = 'pending'
    `).all(pr.id);

    for (const r of reviewers) {
      await notificationService.sendNotification(
        r.developer_id,
        'sla_warning',
        `SLA Warning: PR #${pr.id} (${threshold})`,
        `PR #${pr.id} "${pr.title}" is approaching its SLA limit. Current progress: ${threshold}.`,
        priority,
        { prId: pr.id, threshold }
      );
    }
  }

  async getSLAComplianceRate(repositoryId, daysLookback = 30) {
    if (!dbManager.isAvailable()) return 0;

    const since = new Date(Date.now() - daysLookback * 24 * 60 * 60 * 1000).toISOString();
    
    const stats = dbManager.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN merged_at <= datetime(created_at, '+' || ? || ' hours') THEN 1 ELSE 0 END) as compliant
      FROM pull_requests pr
      JOIN repositories r ON pr.repository_id = r.id
      WHERE pr.repository_id = ? AND pr.status = 'merged' AND pr.merged_at >= ?
    `).get(24, repositoryId, since); // Assuming 24h if not joined correctly

    if (!stats || stats.total === 0) return 100;
    return (stats.compliant / stats.total) * 100;
  }
}

export const slaMonitor = new SLAMonitor();
export default slaMonitor;
