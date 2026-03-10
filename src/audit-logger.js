import { dbManager } from './database.js';

export class AuditLogger {
  constructor() {}

  async logAction(actionType, actorId, resourceType, resourceId, details = {}, options = {}) {
    if (!dbManager.isAvailable()) return;

    dbManager.db.prepare(`
      INSERT INTO audit_trail (
        timestamp, action_type, actor_type, actor_id, 
        resource_type, resource_id, action_details, ip_address, user_agent
      ) VALUES (CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionType,
      options.actorType || 'system',
      actorId.toString(),
      resourceType,
      resourceId.toString(),
      JSON.stringify(details),
      options.ipAddress || null,
      options.userAgent || null
    );
  }

  async getAuditLogs(filters = {}, pagination = { limit: 50, offset: 0 }) {
    if (!dbManager.isAvailable()) return [];

    let query = 'SELECT * FROM audit_trail WHERE 1=1';
    const params = [];

    if (filters.actionType) {
      query += ' AND action_type = ?';
      params.push(filters.actionType);
    }
    if (filters.actorId) {
      query += ' AND actor_id = ?';
      params.push(filters.actorId);
    }
    if (filters.resourceType) {
      query += ' AND resource_type = ?';
      params.push(filters.resourceType);
    }
    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(pagination.limit, pagination.offset);

    return dbManager.db.prepare(query).all(...params);
  }

  async generateAuditReport(filters = {}) {
    const logs = await this.getAuditLogs(filters, { limit: 1000, offset: 0 });
    
    let report = `Audit Report - Generated at ${new Date().toISOString()}\n`;
    report += `==========================================================\n\n`;
    
    for (const log of logs) {
      report += `[${log.timestamp}] ${log.action_type.toUpperCase()} by ${log.actor_id} on ${log.resource_type} #${log.resource_id}\n`;
      report += `Details: ${log.action_details}\n`;
      report += `----------------------------------------------------------\n`;
    }
    
    return report;
  }
}

export const auditLogger = new AuditLogger();
export default auditLogger;
