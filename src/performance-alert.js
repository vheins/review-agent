import { dbManager } from './database.js';
import { metricsEngine } from './metrics-engine.js';

export class PerformanceAlertService {
  constructor() {}

  async checkDeveloperPerformance(developerId, weeksToLookBack = 4) {
    if (!dbManager.isAvailable()) return null;

    // A simple implementation of monitoring developer vs team average
    // Get the team average for the last N weeks
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (weeksToLookBack * 7));
    
    const filters = {
      startDate: startDate.toISOString(),
      endDate: today.toISOString()
    };

    const teamMetrics = await metricsEngine.calculateMetrics(filters);
    const devMetrics = await metricsEngine.getDeveloperMetrics(developerId, filters);
    
    if (!teamMetrics || !devMetrics || teamMetrics.total_reviews === 0) return null;

    const teamAvgApproval = teamMetrics.approval_rate;
    const devApproval = devMetrics.approval_rate;
    
    const teamAvgTime = teamMetrics.avg_duration;
    const devAvgTime = devMetrics.avg_review_time;

    let alertTriggered = false;
    let reasons = [];

    // Trigger alert if developer approval rate is >20% lower than team average
    if (devApproval < teamAvgApproval - 20) {
      alertTriggered = true;
      reasons.push(`Approval rate (${devApproval.toFixed(1)}%) is significantly below team average (${teamAvgApproval.toFixed(1)}%)`);
    }

    // Trigger alert if developer avg time is >50% slower than team average
    if (devAvgTime > teamAvgTime * 1.5) {
      alertTriggered = true;
      reasons.push(`Average review time is significantly higher than team average`);
    }

    if (alertTriggered) {
      this.generateAlert(developerId, reasons);
    }

    return {
      alertTriggered,
      reasons,
      teamMetrics,
      devMetrics
    };
  }

  generateAlert(developerId, reasons) {
    if (!dbManager.isAvailable()) return;
    
    const message = `Performance alert: ${reasons.join('. ')}`;
    
    dbManager.db.prepare(`
      INSERT INTO notifications (
        recipient_id, notification_type, title, message, priority, created_at
      ) VALUES (?, 'performance_alert', 'Performance Review Needed', ?, 'high', CURRENT_TIMESTAMP)
    `).run(developerId, message);
  }
}

export const performanceAlertService = new PerformanceAlertService();
export default performanceAlertService;
