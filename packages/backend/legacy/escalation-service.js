import { dbManager } from './database.js';
import { notificationService } from './notification-service.js';
import { logger } from './logger.js';

export class EscalationService {
  constructor() {}

  async escalate(resourceId, resourceType, reason, severity = 'high') {
    if (!dbManager.isAvailable()) return;

    // 1. Determine level
    const level = this.determineEscalationLevel(severity);
    
    // 2. Identify stakeholders
    const stakeholders = await this.getStakeholders(level);
    
    // 3. Create Audit Trail
    dbManager.db.prepare(`
      INSERT INTO audit_trail (
        timestamp, action_type, actor_type, actor_id, 
        resource_type, resource_id, action_details
      ) VALUES (CURRENT_TIMESTAMP, 'escalation', 'system', 'escalation-service', ?, ?, ?)
    `).run(resourceType, resourceId.toString(), JSON.stringify({ reason, severity, level }));

    // 4. Notify
    for (const stakeholder of stakeholders) {
      await notificationService.sendNotification(
        stakeholder.id,
        'escalation',
        `ESCALATION: ${reason}`,
        `A ${resourceType} (#${resourceId}) has been escalated to you (Level: ${level}). Reason: ${reason}`,
        'urgent',
        { resourceId, resourceType, level }
      );
    }

    logger.warn(`Escalated ${resourceType} #${resourceId} to Level ${level}. Reason: ${reason}`);
  }

  determineEscalationLevel(severity) {
    if (severity === 'critical') return 'manager';
    if (severity === 'high') return 'lead';
    return 'none';
  }

  async getStakeholders(level) {
    if (level === 'none') return [];
    
    // In a real app, we might filter by team or repository ownership
    // For now we get all users with the required role
    return dbManager.db.prepare(
      'SELECT id, github_username FROM developers WHERE role = ?'
    ).all(level);
  }

  async checkSLABreaches() {
    if (!dbManager.isAvailable()) return;

    // Fetch open PRs that exceeded SLA
    // We assume repositories.sla_hours exists
    const breachedPRs = dbManager.db.prepare(`
      SELECT pr.id, pr.title, r.sla_hours, pr.created_at
      FROM pull_requests pr
      JOIN repositories r ON pr.repository_id = r.id
      WHERE pr.status = 'open'
      AND datetime(pr.created_at, '+' || r.sla_hours || ' hours') < CURRENT_TIMESTAMP
    `).all();

    for (const pr of breachedPRs) {
      await this.escalate(pr.id, 'pull_request', `SLA of ${pr.sla_hours}h exceeded`, 'high');
    }
  }
}

export const escalationService = new EscalationService();
export default escalationService;
